-- Meta Lead Ads integration — Supabase migration
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS meta_leads (
  id BIGSERIAL PRIMARY KEY,
  leadgen_id TEXT UNIQUE,
  name TEXT,
  email TEXT,
  phone TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  ad_id TEXT,
  form_id TEXT,
  form_name TEXT,
  raw_fields JSONB,
  page_id TEXT,
  status TEXT DEFAULT 'new',
  call_time TEXT,
  notes TEXT,
  wa_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meta_messages (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT REFERENCES meta_leads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  message TEXT NOT NULL,
  wa_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meta_messages_lead_id_idx ON meta_messages(lead_id);
CREATE INDEX IF NOT EXISTS meta_leads_created_at_idx ON meta_leads(created_at DESC);
