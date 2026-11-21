'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const CSV_FILE = path.join(DATA_DIR, 'leads.csv');
const SALES_FILE = path.join(DATA_DIR, 'sales.json');
const SALES_CSV = path.join(DATA_DIR, 'sales.csv');
const LOG_FILE = path.join(DATA_DIR, 'followup_log.jsonl');

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS leads (
    id text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    type text NOT NULL DEFAULT 'mockup',
    business text NOT NULL,
    category text NOT NULL DEFAULT 'other',
    city text NOT NULL DEFAULT '',
    name text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    email text NOT NULL DEFAULT '',
    consent boolean NOT NULL DEFAULT false,
    score integer,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'new',
    followup jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS sales (
    reference text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    plan text,
    amount bigint,
    monthly_amount bigint,
    business text NOT NULL DEFAULT '',
    email text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'pending',
    lead_id text NOT NULL DEFAULT '',
    paid_at timestamptz,
    verified_at timestamptz,
    subscription_code text,
    subscription_status text,
    subscription_error text
  )`,
  `CREATE TABLE IF NOT EXISTS followup_log (
    id bigserial PRIMARY KEY,
    at timestamptz NOT NULL DEFAULT now(),
    lead_id text NOT NULL DEFAULT '',
    step integer,
    channel text,
    status text,
    recipient text,
    error text
  )`
];

let sqlPromise = null;

function isNeon() {
  const url = process.env.DATABASE_URL || '';
  return /^postgres(ql)?:\/\//.test(url);
}

async function getSql() {
  if (!isNeon()) return null;
  if (!sqlPromise) {
    sqlPromise = (async () => {
      const { neon } = require('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);
      for (const statement of SCHEMA_STATEMENTS) {
        await sql.query(statement);
      }
      console.log('[store] Neon schema ready');
      return sql;
    })().catch((err) => {
      sqlPromise = null;
      throw err;
    });
  }
  return sqlPromise;
}

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]\n');
  if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, 'id,createdAt,type,business,category,city,name,phone,email,score,status\n');
  }
  if (!fs.existsSync(SALES_FILE)) fs.writeFileSync(SALES_FILE, '[]\n');
  if (!fs.existsSync(SALES_CSV)) {
    fs.writeFileSync(SALES_CSV, 'reference,createdAt,plan,amount,business,email,phone,status,leadId\n');
  }
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '');
}

function readJson(file, fallback) {
  ensureData();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (err) {
    console.error(`[store] could not read ${path.basename(file)}:`, err.message);
    return fallback;
  }
}

function writeJson(file, value) {
  ensureData();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

function csvCell(value) {
  const s = String(value == null ? '' : value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function writeLeadsCsv(leads) {
  ensureData();
  const head = 'id,createdAt,type,business,category,city,name,phone,email,score,status';
  const keys = ['id', 'createdAt', 'type', 'business', 'category', 'city', 'name', 'phone', 'email', 'score', 'status'];
  fs.writeFileSync(CSV_FILE, head + '\n' + leads.map((l) => keys.map((k) => csvCell(l[k])).join(',')).join('\n') + (leads.length ? '\n' : ''));
}

function writeSalesCsv(sales) {
  ensureData();
  const head = 'reference,createdAt,plan,amount,business,email,phone,status,leadId';
  const keys = ['reference', 'createdAt', 'plan', 'amount', 'business', 'email', 'phone', 'status', 'leadId'];
  fs.writeFileSync(SALES_CSV, head + '\n' + sales.map((s) => keys.map((k) => csvCell(s[k])).join(',')).join('\n') + (sales.length ? '\n' : ''));
}

function iso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function json(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

function rowToLead(row) {
  return {
    id: row.id,
    createdAt: iso(row.created_at),
    type: row.type,
    business: row.business,
    category: row.category,
    city: row.city,
    name: row.name,
    phone: row.phone,
    email: row.email,
    consent: Boolean(row.consent),
    score: row.score == null ? null : Number(row.score),
    details: json(row.details, {}),
    status: row.status,
    followup: json(row.followup, null)
  };
}

function rowToSale(row) {
  return {
    reference: row.reference,
    createdAt: iso(row.created_at),
    plan: row.plan,
    amount: row.amount == null ? null : Number(row.amount),
    monthlyAmount: row.monthly_amount == null ? null : Number(row.monthly_amount),
    business: row.business,
    email: row.email,
    phone: row.phone,
    status: row.status,
    leadId: row.lead_id,
    paidAt: iso(row.paid_at),
    verifiedAt: iso(row.verified_at),
    subscriptionCode: row.subscription_code,
    subscriptionStatus: row.subscription_status,
    subscriptionError: row.subscription_error
  };
}

async function listLeads() {
  if (isNeon()) {
    const sql = await getSql();
    const rows = await sql`SELECT * FROM leads ORDER BY created_at ASC`;
    return rows.map(rowToLead);
  }
  return readJson(LEADS_FILE, []);
}

async function addLead(lead) {
  if (isNeon()) {
    const sql = await getSql();
    await sql`
      INSERT INTO leads (id, created_at, type, business, category, city, name, phone, email, consent, score, details, status)
      VALUES (
        ${lead.id}, ${lead.createdAt}, ${lead.type}, ${lead.business}, ${lead.category}, ${lead.city},
        ${lead.name}, ${lead.phone}, ${lead.email}, ${lead.consent}, ${lead.score},
        ${JSON.stringify(lead.details || {})}::jsonb, ${lead.status}
      )
    `;
    return;
  }
  const leads = readJson(LEADS_FILE, []);
  leads.push(lead);
  writeJson(LEADS_FILE, leads);
  writeLeadsCsv(leads);
}

async function setLeadStatus(id, status) {
  if (isNeon()) {
    const sql = await getSql();
    await sql`UPDATE leads SET status = ${status} WHERE id = ${id}`;
    return;
  }
  const leads = readJson(LEADS_FILE, []);
  const lead = leads.find((l) => l.id === id);
  if (lead) {
    lead.status = status;
    writeJson(LEADS_FILE, leads);
    writeLeadsCsv(leads);
  }
}

async function optOutLead(id) {
  if (isNeon()) {
    const sql = await getSql();
    await sql`UPDATE leads SET consent = false, status = 'lost' WHERE id = ${id}`;
    return;
  }
  const leads = readJson(LEADS_FILE, []);
  const lead = leads.find((l) => l.id === id);
  if (lead) {
    lead.consent = false;
    lead.status = 'lost';
    writeJson(LEADS_FILE, leads);
    writeLeadsCsv(leads);
  }
}

async function setLeadFollowup(id, followup) {
  if (isNeon()) {
    const sql = await getSql();
    await sql`UPDATE leads SET followup = ${JSON.stringify(followup || null)}::jsonb WHERE id = ${id}`;
    return;
  }
  const leads = readJson(LEADS_FILE, []);
  const lead = leads.find((l) => l.id === id);
  if (lead) {
    lead.followup = followup;
    writeJson(LEADS_FILE, leads);
  }
}

async function markLeadsWon(email, phone) {
  const emailValue = String(email || '').trim();
  const digits = String(phone || '').replace(/\D/g, '');
  if (!emailValue && !digits) return 0;

  if (isNeon()) {
    const sql = await getSql();
    const rows = emailValue && digits
      ? await sql`UPDATE leads SET status = 'won' WHERE lower(email) = lower(${emailValue}) OR regexp_replace(phone, '\\D', '', 'g') = ${digits} RETURNING id`
      : emailValue
        ? await sql`UPDATE leads SET status = 'won' WHERE lower(email) = lower(${emailValue}) RETURNING id`
        : await sql`UPDATE leads SET status = 'won' WHERE regexp_replace(phone, '\\D', '', 'g') = ${digits} RETURNING id`;
    return rows.length;
  }

  const leads = readJson(LEADS_FILE, []);
  let changed = 0;
  leads.forEach((lead) => {
    const matchesEmail = emailValue && lead.email && String(lead.email).toLowerCase() === emailValue.toLowerCase();
    const matchesPhone = digits && lead.phone && String(lead.phone).replace(/\D/g, '') === digits;
    if (matchesEmail || matchesPhone) {
      lead.status = 'won';
      changed++;
    }
  });
  if (changed) {
    writeJson(LEADS_FILE, leads);
    writeLeadsCsv(leads);
  }
  return changed;
}

async function listSales() {
  if (isNeon()) {
    const sql = await getSql();
    const rows = await sql`SELECT * FROM sales ORDER BY created_at ASC`;
    return rows.map(rowToSale);
  }
  return readJson(SALES_FILE, []);
}

async function findSale(reference) {
  if (isNeon()) {
    const sql = await getSql();
    const rows = await sql`SELECT * FROM sales WHERE reference = ${reference} LIMIT 1`;
    return rows[0] ? rowToSale(rows[0]) : null;
  }
  return readJson(SALES_FILE, []).find((s) => s.reference === reference) || null;
}

async function upsertSale(sale) {
  if (isNeon()) {
    const sql = await getSql();
    await sql`
      INSERT INTO sales (
        reference, created_at, plan, amount, monthly_amount, business, email, phone, status,
        lead_id, paid_at, verified_at, subscription_code, subscription_status, subscription_error
      ) VALUES (
        ${sale.reference}, ${sale.createdAt || new Date().toISOString()}, ${sale.plan || null}, ${sale.amount || null},
        ${sale.monthlyAmount || null}, ${sale.business || ''}, ${sale.email || ''}, ${sale.phone || ''},
        ${sale.status || 'pending'}, ${sale.leadId || ''}, ${sale.paidAt || null}, ${sale.verifiedAt || null},
        ${sale.subscriptionCode || null}, ${sale.subscriptionStatus || null}, ${sale.subscriptionError || null}
      )
      ON CONFLICT (reference) DO UPDATE SET
        plan = EXCLUDED.plan,
        amount = EXCLUDED.amount,
        monthly_amount = EXCLUDED.monthly_amount,
        business = EXCLUDED.business,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        status = EXCLUDED.status,
        lead_id = EXCLUDED.lead_id,
        paid_at = EXCLUDED.paid_at,
        verified_at = EXCLUDED.verified_at,
        subscription_code = EXCLUDED.subscription_code,
        subscription_status = EXCLUDED.subscription_status,
        subscription_error = EXCLUDED.subscription_error
    `;
    return;
  }
  const sales = readJson(SALES_FILE, []);
  const index = sales.findIndex((s) => s.reference === sale.reference);
  if (index >= 0) sales[index] = Object.assign({}, sales[index], sale);
  else sales.push(sale);
  writeJson(SALES_FILE, sales);
  writeSalesCsv(sales);
}

async function logFollowup(entry) {
  const row = Object.assign({ at: new Date().toISOString() }, entry);
  if (isNeon()) {
    const sql = await getSql();
    await sql`
      INSERT INTO followup_log (at, lead_id, step, channel, status, recipient, error)
      VALUES (${row.at}, ${row.leadId || ''}, ${row.step || null}, ${row.channel || null}, ${row.status || null}, ${row.recipient || row.to || null}, ${row.error || null})
    `;
    return;
  }
  ensureData();
  fs.appendFileSync(LOG_FILE, JSON.stringify(row) + '\n');
}

module.exports = {
  isNeon,
  getSql,
  initLocal: ensureData,
  listLeads,
  addLead,
  setLeadStatus,
  optOutLead,
  setLeadFollowup,
  markLeadsWon,
  listSales,
  findSale,
  upsertSale,
  logFollowup
};
