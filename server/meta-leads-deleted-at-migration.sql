-- Meta Leads: add soft-delete support
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to run multiple times — IF NOT EXISTS protects against duplicates

-- 1. Add deleted_at column (NULL = active lead, non-NULL = soft-deleted)
ALTER TABLE meta_leads
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Partial index: makes "active leads" queries fast
CREATE INDEX IF NOT EXISTS meta_leads_active_idx
  ON meta_leads(created_at DESC)
  WHERE deleted_at IS NULL;

-- 3. Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'meta_leads'
  AND column_name = 'deleted_at';
