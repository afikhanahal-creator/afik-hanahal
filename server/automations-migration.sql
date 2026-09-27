-- ─── WhatsApp automations — one-time Supabase migration ─────────────────────
-- Run once in Supabase → SQL editor. Safe to re-run (IF NOT EXISTS everywhere).
-- Used by lib/automations.js and the admin tab "אוטומציות".

-- Key/value settings (the automations config is stored under key 'automations')
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Every WhatsApp message the automation system sent (or tried to send)
CREATE TABLE IF NOT EXISTS automation_log (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  lead_id      TEXT,
  phone        TEXT,
  name         TEXT,
  rule_key     TEXT,          -- welcome | noreply:1 | stage:won | reply:positive | reengage | manual | test
  template_id  TEXT,
  message      TEXT,
  ok           BOOLEAN DEFAULT FALSE,
  error        TEXT,
  by           TEXT           -- auto | cron | manual
);
CREATE INDEX IF NOT EXISTS automation_log_created_at_idx ON automation_log (created_at DESC);
CREATE INDEX IF NOT EXISTS automation_log_lead_idx       ON automation_log (lead_id);

-- Only the server (service key) reads and writes these tables
ALTER TABLE app_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_log ENABLE ROW LEVEL SECURITY;
