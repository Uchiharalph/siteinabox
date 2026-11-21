'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const handlers = require('./lib/handlers.cjs');
const store = require('./lib/store.cjs');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.LEAD_API_TOKEN || '';
const MAX_BODY = 16 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return sendJson(res, 400, { error: 'Bad path' });
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const filePath = path.resolve(PUBLIC_DIR, '.' + pathname);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return sendJson(res, 404, { error: 'Not found' });
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();

  try {
    if (p.startsWith('/api/')) {
      const needsBody = req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT';
      const body = needsBody ? await readBody(req) : {};
      const result = await handlers.handle({
        method: req.method,
        path: p,
        query: url.searchParams,
        body: body,
        headers: req.headers,
        ip: ip
      });

      if (result.redirect) {
        res.writeHead(302, { Location: result.redirect });
        return res.end();
      }
      if (result.html !== undefined) return send(res, result.status, result.html, result.contentType);
      return sendJson(res, result.status, result.json);
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      return serveStatic(req, res, url);
    }
    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[server]', err.message);
    if (!res.headersSent) return sendJson(res, 500, { error: 'Server error.' });
    res.end();
  }
});

if (!store.isNeon()) store.initLocal();

server.listen(PORT, () => {
  console.log(`Lead machine running at http://localhost:${PORT}`);
  console.log(`Lead inbox: http://localhost:${PORT}/admin.html`);
  console.log(store.isNeon() ? 'Storage: Neon Postgres' : 'Storage: local files (lead-machine/data/)');
  if (!ADMIN_TOKEN) console.log('WARNING: LEAD_API_TOKEN is not set — admin endpoints are open. Set it before deploying.');
});
