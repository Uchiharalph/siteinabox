-- SiteInABox tables for Neon Postgres.
-- The app also runs these automatically on first request, so this file is
-- only needed if you want to set the schema up manually in the Neon SQL Editor.

CREATE TABLE IF NOT EXISTS leads (
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
);

CREATE TABLE IF NOT EXISTS sales (
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
);

CREATE TABLE IF NOT EXISTS followup_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  lead_id text NOT NULL DEFAULT '',
  step integer,
  channel text,
  status text,
  recipient text,
  error text
);

CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);
CREATE INDEX IF NOT EXISTS sales_created_at_idx ON sales (created_at);
