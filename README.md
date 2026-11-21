# SiteInABox — lead magnet, landing page, follow-up & checkout

A small self-contained Node app. No framework, no build step. One lightweight dependency (`@neondatabase/serverless`) for Vercel deployment.

Recommended public address: **`https://siteinabox.divineguardian.org`**

## What's here

| Page / file | Purpose |
|---|---|
| `public/index.html` | Landing page with pricing cards wired to Paystack |
| `public/mockup.html` | Instant mockup generator — live preview, saves the lead |
| `public/audit.html` | Findability scorecard — saves the lead, shareable result |
| `public/checkout.html` | Collects details, then redirects to Paystack |
| `public/success.html` | Payment result page |
| `public/admin.html` | Lead inbox: counts, statuses, CSV export |
| `server.cjs` | Local dev server (static files + delegates `/api` to handlers) |
| `followup.cjs` | 5-day follow-up engine and message templates |
| `lib/store.cjs` | Storage adapter — Neon Postgres or local JSON |
| `lib/handlers.cjs` | Shared `/api` route logic |
| `api/*.js` | Vercel serverless function entry points |
| `neon/schema.sql` | Postgres table definitions |
| `pricing.json` | **Edit prices here** — setup fees and monthly fee |
| `package.json` | Declares the Neon dependency Vercel needs to install |
| `.env.example` | Every environment variable you can set |

Data goes to Neon Postgres when `DATABASE_URL` is set; otherwise to `lead-machine/data/` (created on first run): `leads.json`, `leads.csv`, `sales.json`, `sales.csv`, `followup_log.jsonl`.

## Run locally

```bash
npm run site
```

- http://localhost:3000/ — landing page
- http://localhost:3000/mockup.html — try the mockup
- http://localhost:3000/audit.html — try the audit
- http://localhost:3000/admin.html — lead inbox (leave token blank locally)

Try examples: `/mockup.html?demo=salon`, `?demo=restaurant`, `?demo=trades`.

## Deploying to Vercel with Neon

The app has two run modes:

- **Local (`npm run site`)** — with no `DATABASE_URL`, data goes to `lead-machine/data/*.json`. Nothing beyond `npm install` needed.
- **Vercel** — with `DATABASE_URL` set to a Neon connection string, every API route reads/writes Neon Postgres instead. Static pages come from `public/`, and the API is serverless functions in `api/`.

### 1. Create the Neon database

1. Sign up at [neon.com](https://neon.com) and create a project (free tier is fine).
2. Copy the connection string from **Connect → Connection string** (starts with `postgresql://`).
3. Tables are created automatically on the first API request. To do it manually, paste `neon/schema.sql` into the Neon SQL Editor.

### 2. Push to GitHub

Create a GitHub repo and push this `lead-machine/` folder. If you push the parent folder instead, set Vercel's **Root Directory** to `lead-machine`. Do not commit `data/` or any `.env` file — add both to `.gitignore`.

### 3. Import into Vercel

1. Vercel → **Add New → Project** → import the repo.
2. Set **Root Directory** to `lead-machine`. This folder has its own `package.json`, so Vercel installs `@neondatabase/serverless` and detects the `api/` functions at the root.
3. Framework Preset: **Other**. Leave Build Command empty. With this preset Vercel serves the `public/` folder at `/` automatically (it does this whenever a `public/` folder exists), so no `outputDirectory` setting is needed.
4. Add the environment variables below.
5. Deploy.

After deploying, `/` should show the landing page and `/api/health` should return JSON. If `/` 404s, check that Root Directory is `lead-machine` and the preset is **Other**.

### 4. Environment variables on Vercel

At minimum:

```
DATABASE_URL=postgresql://...
PUBLIC_BASE_URL=https://siteinabox.divineguardian.org
LEAD_API_TOKEN=<long random string>
FOLLOWUP_SECRET=<different long random string>
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_MONTHLY_PLAN_CODE=<your monthly plan code>
```

Plus whichever delivery provider you use (`RESEND_API_KEY`, `TERMII_API_KEY`, etc.). Full list in `.env.example`. **Never put the Neon or Paystack secret in a browser-facing file.**

### 5. Follow-up scheduling on Vercel

Vercel has no cron. Use cron-job.org or UptimeRobot to GET this once a day:

```
https://siteinabox.divineguardian.org/api/followup/run?token=YOUR_LEAD_API_TOKEN
```

Each run processes one step per due lead, so nobody gets multiple messages at once.

### 6. Verify

- `/api/health` → `{ "ok": true, ... }`
- `/api/config` → shows your current pricing
- Submit the mockup tool, then check `/admin.html` with your `LEAD_API_TOKEN`.

### Files involved

| Path | Role |
|---|---|
| `lib/store.cjs` | Switches between Neon and local JSON automatically |
| `lib/handlers.cjs` | All `/api` route logic, shared by both run modes |
| `api/*.js` | Vercel serverless function entry points |
| `neon/schema.sql` | Table definitions (also auto-created on first request) |
| `vercel.json` | Vercel routing config |

## Environment variables

Copy `.env.example` into your host's environment panel. The important ones:

| Variable | Why |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string. Required on Vercel; optional locally |
| `PUBLIC_BASE_URL` | Full public URL — used in unsubscribe links, Paystack callbacks, previews |
| `LEAD_API_TOKEN` | Protects `/admin.html` and `/api/followup/run` |
| `FOLLOWUP_SECRET` | Signs unsubscribe links |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email delivery |
| `TERMII_API_KEY` or `TWILIO_*` | SMS delivery |
| `FOLLOWUP_WEBHOOK_URL` | No-code delivery to n8n / Make / Zapier |
| `PAYSTACK_SECRET_KEY` | Card checkout via API |
| `PAYSTACK_MONTHLY_PLAN_CODE` | Paystack monthly plan code, used after the setup fee is paid |
| `PAYSTACK_LAUNCH_URL`, `PAYSTACK_DFY_URL` | Optional dashboard payment links (take priority) |

## Pricing

All prices live in `pricing.json`. Current defaults:

| Plan | Setup (one-time) | Then |
|---|---|---|
| Free mockup | ₦0 | — |
| Launch | ₦60,000 — includes the .org domain for year one | ₦10,000/month |
| Done-for-you | ₦150,000 — domain + full setup | ₦10,000/month |

Change `setupNgn` or `monthlyNgn` in `pricing.json` and every page, checkout amount and follow-up message updates automatically. Domain renewal after year one is billed separately at cost.

## Follow-up sequence

Five touches over five days, anchored to the lead's signup date:

| Day | Message |
|---|---|
| 0 | "Your mockup is ready" + their preview link |
| 1 | "Did you get a chance to look?" |
| 2 | How ordering works + ₦10k/month |
| 3 | Share the link on WhatsApp and Google Maps |
| 5 | Last note, "Reply GO LIVE" |

Every message includes an opt-out. Clicking it sets `consent: false` and `status: lost`, so the lead is never contacted again. Leads marked `won`, `lost`, or older than 30 days are skipped. One step per run per lead, so a late run never blasts several messages at once.

### See the messages before sending anything

```bash
npm run followup:preview       # prints all 5 email + SMS messages
npm run followup:dry           # simulates the due steps, writes nothing
```

### Send for real

Set at least one delivery method, then either run manually:

```bash
npm run followup
```

Or schedule it. On a VPS with cron, daily at 9am:

```cron
0 9 * * * cd /path/to/Job\ Finder && node lead-machine/followup.cjs >> lead-machine/data/cron.log 2>&1
```

On Vercel/Render/Railway (no cron), call the protected endpoint once a day from cron-job.org or UptimeRobot:

```
https://siteinabox.divineguardian.org/api/followup/run?token=YOUR_LEAD_API_TOKEN
```

Add `&dry` to simulate. The endpoint returns a JSON summary of what was processed.

### Delivery options

- **Email:** Resend. Set `EMAIL_FROM` to a verified sender (e.g. `hello@siteinabox.divineguardian.org`). While using Resend's default `onboarding@resend.dev`, recipients must be the account owner.
- **SMS:** Termii (good for Nigerian numbers) or Twilio.
- **No-code:** set `FOLLOWUP_WEBHOOK_URL`; each step POSTs JSON with `leadId`, `step`, `channel`, `to`, `email`, `phone`, `name`, `business`, `subject`, `text`, `unsubscribe`. n8n/Make can then send via any provider.
- `FOLLOWUP_CHANNEL=auto` picks email → SMS → webhook. Force one with `email`, `sms`, or `webhook`.

## Paystack

Prices come from `pricing.json`. Each plan has a **one-time setup fee** (Launch ₦60,000, Done-for-you ₦150,000) that includes the .org domain for year one, then ₦10,000/month.

Two ways to take payment — pick either or both.

### A. Dashboard payment links (simplest)

Create a **one-time payment link for the setup fee** in Paystack for each plan, paste them into `PAYSTACK_LAUNCH_URL` and `PAYSTACK_DFY_URL`, and the pricing buttons go straight there. This is the fastest option. A payment link alone does not recur — use a Paystack subscription plan for the monthly fee (below).

### B. Built-in checkout (recommended)

Set `PAYSTACK_SECRET_KEY`. The pricing buttons then open `/checkout.html`, which creates a Paystack transaction server-side for the **setup fee** and redirects to `authorization_url`. Paystack calls back to `/api/paystack/callback?reference=...`, which verifies the transaction, saves it to the configured store (Neon or `data/sales.json`), and marks the matching lead `won`.

For the ₦10,000/month: create a monthly plan in Paystack, set `PAYSTACK_MONTHLY_PLAN_CODE`, and the callback uses the captured authorization to create a subscription after the setup fee succeeds. Paystack then handles the monthly debits. If no plan code is set, the setup fee still works — you just bill the monthly fee manually.

Set Paystack's dashboard callback URL to:

```
https://siteinabox.divineguardian.org/api/paystack/callback
```

Test with test keys first. Never put the secret key in a browser-facing file.

## Subdomain: siteinabox.divineguardian.org

Yes — this is the right move. It's free, keeps everything under a domain you already own, and inherits that domain's trust. DNS names are case-insensitive, so use lowercase `siteinabox`.

### Namecheap DNS

1. Namecheap → **Domain List** → **Manage** next to `divineguardian.org` → **Advanced DNS**.
2. Add a record:
   - **Type:** `CNAME Record`
   - **Host:** `siteinabox`
   - **Value:** the target Vercel gives you (usually `cname.vercel-dns.com` — copy exactly what Vercel shows)
   - **TTL:** Automatic
3. Remove any conflicting `siteinabox` record or wildcard `*.divineguardian.org` CNAME.

### Vercel

1. Vercel project → **Settings** → **Domains** → add `siteinabox.divineguardian.org`.
2. Copy the DNS value Vercel displays into Namecheap above.
3. Wait for Vercel to issue SSL (automatic).
4. Set `PUBLIC_BASE_URL=https://siteinabox.divineguardian.org` in Vercel environment variables and redeploy.

Your existing `divineguardian.org` site is unaffected. If you later want to sell SiteInABox as a standalone product, you can move it to its own domain — nothing in the code hardcodes the hostname.

## Getting clients

The tools are the hook. Every share captures a lead:

1. Share `/mockup.html` in Facebook groups, NairaLand, LinkedIn, and short before/after videos.
2. Share `/audit.html` — the score makes the fix obvious, and the result link is shareable.
3. Give partners `?ref=their-name` links and 20% recurring commission (Paystack splits). The source is stored on every lead.
4. Run a small ₦3k/day ad to `/mockup.html` and measure cost per lead before scaling.
5. Convert the warm leads from your existing list manually, from the phone only.

No WhatsApp or Instagram automation is used anywhere.

## Security notes

- Set `LEAD_API_TOKEN` before deploying; it protects the lead inbox and follow-up trigger.
- Set `FOLLOWUP_SECRET` before deploying; it signs unsubscribe links.
- Keep `lead-machine/data/` private — never publish it to a public repo or static host.
- All lead-supplied text is escaped in the admin view.
- Submission rate limit: 12 per IP per 10 minutes.
