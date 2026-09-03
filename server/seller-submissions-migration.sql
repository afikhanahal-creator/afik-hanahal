-- ─── Seller intake form (/sell) — one-time Supabase migration ────────────────
-- Run once in Supabase → SQL editor. Safe to re-run (IF NOT EXISTS everywhere).

CREATE TABLE IF NOT EXISTS seller_submissions (
  id              BIGSERIAL PRIMARY KEY,
  ref             TEXT UNIQUE,                 -- human-friendly file number, e.g. AH-260903-K7PD
  sid             TEXT,                        -- browser session id = storage folder name
  status          TEXT DEFAULT 'new',          -- new | contacted | meeting | signed | marketing | closed | rejected
  lang            TEXT DEFAULT 'he',
  contact_name    TEXT,
  phone           TEXT,
  email           TEXT,
  city            TEXT,
  address         TEXT,
  property_type   TEXT,
  asking_price    NUMERIC,
  answers         JSONB DEFAULT '{}'::jsonb,   -- every answer, keyed by step id (see src/sellerFormSchema.js)
  files           JSONB DEFAULT '[]'::jsonb,   -- [{ name, size, type, kind, tag, path }] — path inside the seller-uploads bucket
  notes           TEXT,                        -- internal office notes
  schema_version  INT DEFAULT 1,
  meta            JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seller_submissions_created_at_idx ON seller_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS seller_submissions_status_idx     ON seller_submissions (status);
CREATE INDEX IF NOT EXISTS seller_submissions_phone_idx      ON seller_submissions (phone);

-- Private bucket for photos / videos / plans / documents.
-- (The API also creates it on first upload if it is missing — this just makes it explicit.)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('seller-uploads', 'seller-uploads', false, 209715200)
ON CONFLICT (id) DO NOTHING;

-- Lock the table down: only the service role (used by /api/seller-form) may touch it.
ALTER TABLE seller_submissions ENABLE ROW LEVEL SECURITY;
