'use strict';

const crypto = require('node:crypto');
const pricing = require('./pricing.json');
const store = require('./lib/store.cjs');

const DAY = 24 * 60 * 60 * 1000;
const MAX_AGE_DAYS = 30;

const DELAYS = [0, 1, 2, 3, 5];

const STEPS = [
  {
    subject: 'Your {business} mockup is ready',
    email: 'Hi {name},\n\nHere is the mockup of your ordering site:\n{link}\n\nOpen it on your phone and tell me what you think. If it looks right, I can get it live for you today.\n\n— Vinks Dev, SiteInABox\n\nDon’t want these emails? Unsubscribe: {unsubscribe}',
    sms: 'Hi {name}, your {business} mockup is ready: {link} — Vinks Dev. Reply STOP to opt out.'
  },
  {
    subject: 'Quick question about {business}',
    email: 'Hi {name},\n\nDid you get a chance to look at your mockup? {link}\n\nMost business owners tell us the same thing: customers ask “do you have a website?” and they have no link to send. This fixes that in one tap.\n\nWant me to set it up for you?\n\n— Vinks Dev\n\nUnsubscribe: {unsubscribe}',
    sms: 'Hi {name}, did you see your {business} mockup? {link} Want me to make it live? Reply STOP to opt out.'
  },
  {
    subject: 'How your customers would order',
    email: 'Hi {name},\n\nHere’s the simple version: your page shows your services and prices, and one WhatsApp button sends the customer straight to you with their order already typed out.\n\nNo website knowledge. No app to install. Your .org domain is included in setup, then {monthly}/month covers hosting, updates and support.\n\nSee it again: {link}\n\n— Vinks Dev\n\nUnsubscribe: {unsubscribe}',
    sms: 'Your {business} page + WhatsApp order button: {link} {monthly}/month after setup. Reply STOP to opt out.'
  },
  {
    subject: 'A page you can be proud of',
    email: 'Hi {name},\n\nOne more thing — a live page makes you look established, even if you’re just starting out. You can share the link on WhatsApp, Instagram, your Google Maps listing and your receipts.\n\nYour preview is here: {link}\n\nIf you want the done-for-you version, reply to this email and I’ll set it up in about 7 days.\n\n— Vinks Dev\n\nUnsubscribe: {unsubscribe}',
    sms: 'Share your {business} link on WhatsApp and Google Maps: {link} Want done-for-you setup? Reply STOP to opt out.'
  },
  {
    subject: 'Last one from me, {name}',
    email: 'Hi {name},\n\nI don’t want to clutter your inbox, so this is my last note.\n\nIf you ever want a simple ordering page for {business}, your mockup is waiting here: {link}\n\nReply “GO LIVE” and I’ll help you get started. Otherwise, no need to reply.\n\n— Achikeh, Vinks Dev\n\nUnsubscribe: {unsubscribe}',
    sms: 'Last one from me — your {business} mockup is here: {link} Reply GO LIVE if you want it live. STOP to opt out.'
  }
];

function secret() {
  return process.env.FOLLOWUP_SECRET || process.env.ADMIN_TOKEN || 'siteinabox-local-secret';
}

function sign(id) {
  return crypto.createHmac('sha256', secret()).update(String(id)).digest('hex').slice(0, 24);
}

function verify(id, signature) {
  if (!id || !signature) return false;
  const expected = sign(id);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function baseUrl() {
  return (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, function (_, key) {
    return values[key] === undefined ? '{' + key + '}' : String(values[key]);
  });
}

function leadLink(lead) {
  if (lead.details && lead.details.previewUrl) return lead.details.previewUrl;
  return baseUrl() + '/mockup.html?b=' + encodeURIComponent(lead.business || 'Your business') +
    '&cat=' + encodeURIComponent(lead.category || 'other') +
    '&city=' + encodeURIComponent(lead.city || '') +
    '&ref=followup';
}

function unsubscribeUrl(lead) {
  return baseUrl() + '/api/optout?id=' + encodeURIComponent(lead.id) + '&sig=' + sign(lead.id);
}

function valuesFor(lead, stepIndex) {
  return {
    name: (lead.name || 'there').split(' ')[0],
    business: lead.business || 'your business',
    link: leadLink(lead),
    monthly: '₦' + Number(pricing.monthlyNgn || 10000).toLocaleString('en-NG'),
    unsubscribe: unsubscribeUrl(lead)
  };
}

function textFor(lead, stepIndex, channel) {
  const step = STEPS[stepIndex];
  return fill(step[channel], valuesFor(lead, stepIndex));
}

function htmlFor(lead, stepIndex) {
  const text = textFor(lead, stepIndex, 'email');
  const unsub = unsubscribeUrl(lead);
  return '<div style="font-family:system-ui,Arial,sans-serif;max-width:600px;line-height:1.6;color:#142630">' +
    escapeHtml(text).split('\n').map(function (line) { return '<p>' + line + '</p>'; }).join('') +
    '<p style="font-size:12px;color:#5c6d75">You received this because you asked for a free mockup at SiteInABox. <a href="' +
    escapeHtml(unsub) + '">Unsubscribe</a>.</p></div>';
}

function chooseChannel(lead) {
  const mode = (process.env.FOLLOWUP_CHANNEL || 'auto').toLowerCase();
  if (mode === 'email') return lead.email ? 'email' : null;
  if (mode === 'sms') return lead.phone ? 'sms' : null;
  if (mode === 'webhook') return (lead.email || lead.phone) ? 'webhook' : null;

  if (lead.email && process.env.RESEND_API_KEY) return 'email';
  if (lead.phone && (process.env.TERMII_API_KEY || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM))) return 'sms';
  if (process.env.FOLLOWUP_WEBHOOK_URL && (lead.email || lead.phone)) return 'webhook';
  return null;
}

async function sendResend(to, subject, text, html, unsubscribe) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Vinks Dev <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      text: text,
      html: html,
      headers: { 'List-Unsubscribe': '<' + unsubscribe + '>' }
    })
  });
  const body = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error(body.message || body.error || 'Resend error ' + res.status);
  return body.id || 'resend';
}

async function sendTermii(to, text) {
  const res = await fetch('https://api.ng.termii.com/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TERMII_API_KEY,
      to: to,
      from: process.env.TERMII_SENDER_ID || 'VinksDev',
      sms: text,
      type: 'plain',
      channel: 'generic'
    })
  });
  const body = await res.json().catch(function () { return {}; });
  if (!res.ok || body.code === 'error') throw new Error(body.message || 'Termii error ' + res.status);
  return body.message_id || 'termii';
}

async function sendTwilio(to, text) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const auth = Buffer.from(sid + ':' + token).toString('base64');
  const digits = String(to).replace(/\D/g, '');
  const e164 = digits.startsWith('0') ? '234' + digits.slice(1) : '+' + digits;
  const form = new URLSearchParams({ To: e164, From: process.env.TWILIO_FROM, Body: text });
  const res = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });
  const body = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error(body.message || 'Twilio error ' + res.status);
  return body.sid || 'twilio';
}

async function sendWebhook(lead, stepIndex, channel, text) {
  const res = await fetch(process.env.FOLLOWUP_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'followup',
      leadId: lead.id,
      step: stepIndex + 1,
      channel: channel === 'webhook' ? (lead.email ? 'email' : 'sms') : channel,
      to: channel === 'sms' ? lead.phone : (lead.email || lead.phone),
      email: lead.email || null,
      phone: lead.phone || null,
      name: lead.name || null,
      business: lead.business,
      subject: STEPS[stepIndex].subject.replace('{business}', lead.business || 'your business'),
      text: text,
      unsubscribe: unsubscribeUrl(lead)
    })
  });
  if (!res.ok) throw new Error('Webhook error ' + res.status);
  return 'webhook';
}

async function deliver(lead, stepIndex, channel, dryRun) {
  const text = textFor(lead, stepIndex, channel === 'email' || channel === 'webhook' ? (lead.email ? 'email' : 'sms') : channel);
  if (dryRun) return { status: 'dry-run', providerId: 'none', text: text };

  if (channel === 'email') {
    const subject = fill(STEPS[stepIndex].subject, valuesFor(lead, stepIndex));
    return { status: 'sent', providerId: await sendResend(lead.email, subject, text, htmlFor(lead, stepIndex), unsubscribeUrl(lead)), text: text };
  }
  if (channel === 'sms') {
    const providerId = process.env.TERMII_API_KEY
      ? await sendTermii(lead.phone, text)
      : await sendTwilio(lead.phone, text);
    return { status: 'sent', providerId: providerId, text: text };
  }
  return { status: 'sent', providerId: await sendWebhook(lead, stepIndex, channel, text), text: text };
}

function shouldProcess(lead, now) {
  if (!lead || !lead.id) return false;
  if (lead.consent === false) return false;
  if (['won', 'lost', 'do_not_contact'].includes(String(lead.status || '').toLowerCase())) return false;
  const created = new Date(lead.createdAt).getTime();
  if (!Number.isFinite(created) || now - created > MAX_AGE_DAYS * DAY) return false;
  if (lead.followup && lead.followup.done) return false;
  const step = lead.followup ? lead.followup.step : 0;
  if (step >= STEPS.length) return false;
  const due = lead.followup && lead.followup.nextSendAt
    ? new Date(lead.followup.nextSendAt).getTime()
    : created;
  return now >= due;
}

function nextDate(lead, stepIndex) {
  if (stepIndex >= STEPS.length) return null;
  const created = new Date(lead.createdAt).getTime();
  return new Date(created + DELAYS[stepIndex] * DAY).toISOString();
}

async function runFollowup(options) {
  const opts = options || {};
  const dryRun = Boolean(opts.dryRun);
  const now = opts.now ? new Date(opts.now).getTime() : Date.now();
  const leads = await store.listLeads();
  const summary = { checked: leads.length, processed: 0, skipped: 0, sent: 0, failed: 0, dryRun: dryRun, details: [] };

  for (const lead of leads) {
    if (!shouldProcess(lead, now)) {
      summary.skipped++;
      continue;
    }

    const stepIndex = lead.followup ? lead.followup.step : 0;
    const channel = chooseChannel(lead);
    if (!channel && !dryRun) {
      summary.skipped++;
      summary.details.push({ lead: lead.id, step: stepIndex + 1, status: 'no-provider' });
      await store.logFollowup({ leadId: lead.id, step: stepIndex + 1, status: 'no-provider' });
      continue;
    }

    try {
      const result = await deliver(lead, stepIndex, channel || 'webhook', dryRun);
      const nextStep = stepIndex + 1;
      const history = (lead.followup && Array.isArray(lead.followup.history)) ? lead.followup.history : [];
      history.push({ step: nextStep, at: new Date(now).toISOString(), channel: channel || 'preview', status: result.status });

      lead.followup = {
        step: nextStep,
        lastSentAt: new Date(now).toISOString(),
        nextSendAt: nextDate(lead, nextStep),
        done: nextStep >= STEPS.length,
        history: history
      };
      if (!dryRun) await store.setLeadFollowup(lead.id, lead.followup);

      summary.processed++;
      if (result.status === 'sent') summary.sent++;
      summary.details.push({
        lead: lead.id,
        business: lead.business,
        step: nextStep,
        channel: channel || 'preview',
        status: result.status,
        to: channel === 'sms' ? lead.phone : (lead.email || lead.phone),
        text: result.text
      });
      if (!dryRun) {
        await store.logFollowup({
          leadId: lead.id,
          step: nextStep,
          channel: channel || 'preview',
          status: result.status,
          recipient: channel === 'sms' ? lead.phone : (lead.email || lead.phone)
        });
      }
    } catch (err) {
      summary.failed++;
      summary.details.push({ lead: lead.id, step: stepIndex + 1, status: 'failed', error: err.message });
      if (!dryRun) await store.logFollowup({ leadId: lead.id, step: stepIndex + 1, status: 'failed', error: err.message });
    }
  }

  return summary;
}

function previewSequence() {
  const sample = {
    id: 'PREVIEW',
    business: 'Sade’s Hair Studio',
    name: 'Sade',
    email: 'sade@example.com',
    phone: '08031234567',
    city: 'Wuse II, Abuja',
    category: 'salon',
    details: { previewUrl: baseUrl() + '/mockup.html?b=Sade%27s%20Hair%20Studio&cat=salon&city=Wuse%20II%2C%20Abuja' }
  };
  return STEPS.map(function (step, i) {
    return {
      step: i + 1,
      day: DELAYS[i],
      emailSubject: fill(step.subject, valuesFor(sample, i)),
      email: textFor(sample, i, 'email'),
      sms: textFor(sample, i, 'sms')
    };
  });
}

module.exports = {
  runFollowup,
  previewSequence,
  sign,
  verify,
  STEPS,
  DELAYS
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--preview')) {
    console.log(JSON.stringify(previewSequence(), null, 2));
  } else {
    const dryRun = args.includes('--dry-run') || args.includes('--preview');
    runFollowup({ dryRun: dryRun }).then(function (summary) {
      console.log(JSON.stringify(summary, null, 2));
    }).catch(function (err) {
      console.error('[followup] failed:', err);
      process.exitCode = 1;
    });
  }
}
