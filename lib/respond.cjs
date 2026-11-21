'use strict';

const handlers = require('./handlers.cjs');

function respond(res, result) {
  res.setHeader('Cache-Control', 'no-store');

  if (result.redirect) {
    res.statusCode = 302;
    res.setHeader('Location', result.redirect);
    return res.end();
  }
  if (result.html !== undefined) {
    res.statusCode = result.status || 200;
    res.setHeader('Content-Type', result.contentType || 'text/html; charset=utf-8');
    return res.end(result.html);
  }
  res.statusCode = result.status || 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(result.json));
}

function createHandler(pathResolver) {
  return async function handler(req, res) {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const path = typeof pathResolver === 'function'
        ? pathResolver(req, url)
        : (pathResolver || url.pathname);
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

      const result = await handlers.handle({
        method: req.method,
        path: path,
        query: url.searchParams,
        body: req.body || {},
        headers: req.headers,
        ip: ip
      });
      return respond(res, result);
    } catch (err) {
      console.error('[api]', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'Server error.' }));
    }
  };
}

module.exports = { respond, createHandler };
