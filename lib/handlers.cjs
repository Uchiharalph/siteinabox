'use strict';

const crypto = require('node:crypto');
const pricing = require('../pricing.json');
const store = require('./store.cjs');
const followup = require('../followup.cjs');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_API = process.env.PAYSTACK_API || 'https://api.paystack.co';
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const PLANS = {
  launch: { amount: pricing.plans.launch.setupNgn * 100, label: pricing.plans.launch.name + ' setup' },
  dfy: { amount: pricing.plans.dfy.setupNgn * 100, label: pricing.plans.dfy.name + ' setup' }
};
const MONTHLY_PLAN_CODE = process.env.PAYSTACK_MONTHLY_PLAN_CODE || process.env.PAYSTACK_LAUNCH_PLAN_CODE || '';

const ADMIN_TOKEN = process.env.LEAD_API_TOKEN || '';
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 12;
const rateMap = new Map();

const ALLOWED_TYPES = new Set(['audit', 'mockup']);
const ALLOWED_CATEGORIES = new Set(['salon', 'restaurant', 'retail', 'health', 'trades', 'other']);
const ALLOWED_STATUS = new Set(['new', 'contacted', 'won', 'lost']);

function json(status, obj) {
  return { status: status, json: obj };
}

function html(status, body) {
  return { status: status, html: body, contentType: 'text/html; charset=utf-8' };
}

function equal(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function tokenOk(headers, query) {
  if (!ADMIN_TOKEN) return true;
  const header = String((headers && headers['x-admin-token']) || '');
  const token = String((query && query.get('token')) || '');
  return equal(header, ADMIN_TOKEN) || equal(token, ADMIN_TOKEN);
}

function rateCheck(ip) {
  const now = Date.now();
  const hits = (rateMap.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    rateMap.set(ip, hits);
    return false;
  }
  hits.push(now);
  rateMap.set(ip, hits);
  return true;
}

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function truthy(value) {
  return value === true || value === 'true' || value === 'on' || value === 1;
}

async function paystackRequest(method, endpoint, body) {
  if (!PAYSTACK_SECRET_KEY) throw new Error('PAYSTACK_SECRET_KEY is not configured.');
  const res = await fetch(PAYSTACK_API + endpoint, {
    method: method,
    headers: {
      Authorization: 'Bearer ' + PAYSTACK_SECRET_KEY,
      'Content-Type': 'application/json'
    },
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) throw new Error(data.message || 'Paystack error ' + res.status);
  return data.data;
}

function optOutPage(title, message) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title>' +
    '<link rel="stylesheet" href="/styles.css"></head><body><section class="section"><div class="container" style="max-width:560px">' +
    '<div class="form-card"><h1>' + title + '</h1><p>' + message + '</p>' +
    '<a class="btn btn-ghost" href="/">Back to SiteInABox</a></div></div></section></body></html>';
}

async function handle(context) {
  const ctx = context || {};
  const method = String(ctx.method || 'GET').toUpperCase();
  const p = String(ctx.path || '/');
  const query = ctx.query;
  const body = ctx.body || {};
  const headers = ctx.headers || {};
  const ip = String(ctx.ip || 'unknown');

  // GET /api/health
  if (method === 'GET' && p === '/api/health') {
    const leads = await store.listLeads();
    const sales = await store.listSales();
    return json(200, { ok: true, leads: leads.length, sales: sales.length });
  }

  // GET /api/config
  if (method === 'GET' && p === '/api/config') {
    return json(200, {
      ok: true,
      baseUrl: PUBLIC_BASE_URL,
      supportWhatsApp: '2347086208596',
      pricing: pricing,
      paystack: {
        launchUrl: process.env.PAYSTACK_LAUNCH_URL || '',
        dfyUrl: process.env.PAYSTACK_DFY_URL || '',
        apiCheckout: Boolean(PAYSTACK_SECRET_KEY)
      }
    });
  }

  // GET /api/optout
  if (method === 'GET' && p === '/api/optout') {
    const id = String((query && query.get('id')) || '');
    const sig = String((query && query.get('sig')) || '');
    if (!followup.verify(id, sig)) {
      return html(400, optOutPage('Link problem', 'This unsubscribe link is invalid. You can reply STOP to any message or email 0708 620 8596.'));
    }
    await store.optOutLead(id);
    return html(200, optOutPage('You’re unsubscribed', 'You will not get any more follow-up messages from us.'));
  }

  // GET|POST /api/followup/run
  if ((method === 'GET' || method === 'POST') && p === '/api/followup/run') {
    if (!tokenOk(headers, query)) return json(401, { error: 'Unauthorized' });
    const dryRun = Boolean(query && query.has('dry'));
    const summary = await followup.runFollowup({ dryRun: dryRun });
    return json(200, Object.assign({ ok: true }, summary));
  }

  // POST /api/paystack/initialize
  if (method === 'POST' && p === '/api/paystack/initialize') {
    if (!PAYSTACK_SECRET_KEY) return json(503, { error: 'Paystack is not configured yet. Set PAYSTACK_SECRET_KEY.' });
    const plan = String(body.plan || '').toLowerCase();
    const email = clean(body.email, 160);
    const business = clean(body.business, 120) || 'My business';
    const name = clean(body.name, 120);
    const phone = clean(body.phone, 40);
    const leadId = clean(body.leadId, 40);

    if (!PLANS[plan]) return json(400, { error: 'Unknown plan.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Enter a valid email address.' });

    const reference = 'SIB-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const payload = {
      email: email,
      reference: reference,
      callback_url: PUBLIC_BASE_URL + '/api/paystack/callback?reference=' + encodeURIComponent(reference),
      metadata: JSON.stringify({
        custom_fields: [
          { display_name: 'Business', variable_name: 'business', value: business },
          { display_name: 'Name', variable_name: 'name', value: name },
          { display_name: 'Phone', variable_name: 'phone', value: phone }
        ],
        plan: plan,
        leadId: leadId,
        business: business,
        name: name,
        phone: phone
      }),
      amount: String(PLANS[plan].amount)
    };

    const data = await paystackRequest('POST', '/transaction/initialize', payload);
    await store.upsertSale({
      reference: reference,
      createdAt: new Date().toISOString(),
      plan: plan,
      amount: Number(payload.amount),
      monthlyAmount: pricing.plans[plan].monthlyNgn * 100,
      business: business,
      email: email,
      phone: phone,
      status: 'pending',
      leadId: leadId
    });
    console.log(`[paystack] initialized ${reference} for ${plan} (${email})`);
    return json(200, { ok: true, authorizationUrl: data.authorization_url, reference: reference });
  }

  // GET /api/paystack/callback
  if (method === 'GET' && p === '/api/paystack/callback') {
    const reference = String((query && (query.get('reference') || query.get('trxref'))) || '');
    try {
      const data = await paystackRequest('GET', '/transaction/verify/' + encodeURIComponent(reference));
      const existing = (await store.findSale(reference)) || {};
      const update = {
        reference: reference,
        status: data.status,
        amount: data.amount,
        paidAt: data.paid_at || null,
        verifiedAt: new Date().toISOString()
      };

      if (data.status === 'success' && MONTHLY_PLAN_CODE && data.authorization && data.authorization.authorization_code) {
        try {
          const sub = await paystackRequest('POST', '/subscription', {
            customer: existing.email || (data.customer && data.customer.email) || '',
            plan: MONTHLY_PLAN_CODE,
            authorization: data.authorization.authorization_code
          });
          update.subscriptionCode = sub.subscription_code || null;
          update.subscriptionStatus = sub.status || null;
          console.log(`[paystack] subscription created ${sub.subscription_code || 'unknown'}`);
        } catch (err) {
          update.subscriptionError = err.message;
          console.error('[paystack] subscription creation failed:', err.message);
        }
      }

      await store.upsertSale(Object.assign({}, existing, update));

      if (data.status === 'success') {
        await store.markLeadsWon(existing.email || (data.customer && data.customer.email) || '', existing.phone || '');
      }
      console.log(`[paystack] callback ${reference}: ${data.status}`);
    } catch (err) {
      console.error('[paystack] callback verify failed:', err.message);
    }
    return { redirect: '/success.html?reference=' + encodeURIComponent(reference) };
  }

  // GET /api/paystack/verify
  if (method === 'GET' && p === '/api/paystack/verify') {
    const reference = String((query && query.get('reference')) || '');
    const sale = await store.findSale(reference);
    if (!sale) return json(404, { ok: false, error: 'Reference not found.' });
    return json(200, {
      ok: true,
      reference: sale.reference,
      status: sale.status,
      plan: sale.plan,
      amount: sale.amount,
      monthlyAmount: sale.monthlyAmount || null,
      business: sale.business,
      email: sale.email,
      paidAt: sale.paidAt || null,
      subscriptionStatus: sale.subscriptionStatus || null
    });
  }

  // POST /api/leads
  if (method === 'POST' && p === '/api/leads') {
    if (!rateCheck(ip)) return json(429, { error: 'Too many requests. Try again shortly.' });

    const type = ALLOWED_TYPES.has(body.type) ? body.type : 'mockup';
    const business = clean(body.business, 120);
    const category = ALLOWED_CATEGORIES.has(body.category) ? body.category : 'other';
    const city = clean(body.city, 80);
    const name = clean(body.name, 120);
    const phone = clean(body.phone, 40);
    const email = clean(body.email, 160);
    const consent = truthy(body.consent);
    const rawScore = Number(body.score);
    const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : null;
    const details = body.details && typeof body.details === 'object' && !Array.isArray(body.details)
      ? body.details
      : {};

    if (!business) return json(400, { error: 'Business name is required.' });
    if (!phone && !email) return json(400, { error: 'Add a phone number or email so we can reach you.' });
    if (!consent) return json(400, { error: 'Please agree to be contacted.' });

    const lead = {
      id: crypto.randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
      type: type,
      business: business,
      category: category,
      city: city,
      name: name,
      phone: phone,
      email: email,
      consent: true,
      score: score,
      details: details,
      status: 'new'
    };

    await store.addLead(lead);
    console.log(`[lead] ${lead.id} ${lead.type} ${lead.business} (${lead.phone || lead.email})`);
    return json(200, { ok: true, id: lead.id, createdAt: lead.createdAt });
  }

  // GET /api/leads
  if (method === 'GET' && p === '/api/leads') {
    if (!tokenOk(headers, query)) return json(401, { error: 'Unauthorized' });
    const leads = (await store.listLeads()).slice().reverse();
    return json(200, { ok: true, count: leads.length, leads: leads });
  }

  // PATCH /api/leads/:id
  const match = p.match(/^\/api\/leads\/([A-Za-z0-9_-]+)$/);
  if (method === 'PATCH' && match) {
    if (!tokenOk(headers, query)) return json(401, { error: 'Unauthorized' });
    const status = String(body.status || '').toLowerCase();
    if (!ALLOWED_STATUS.has(status)) return json(400, { error: 'Invalid status.' });
    const leads = await store.listLeads();
    const lead = leads.find((l) => l.id === match[1]);
    if (!lead) return json(404, { error: 'Lead not found.' });
    await store.setLeadStatus(match[1], status);
    return json(200, { ok: true, lead: Object.assign({}, lead, { status: status }) });
  }

  return json(404, { error: 'Not found' });
}

module.exports = {
  handle,
  tokenOk,
  rateCheck,
  PLANS,
  MONTHLY_PLAN_CODE
};
