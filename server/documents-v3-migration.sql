-- Documents module v3 (2026-11-04): Google Drive sync records. Self-contained: it re-runs v2 (templates, project columns) too,
-- every statement idempotent — run this file once in Supabase → SQL editor (v2 may or may not have been applied before).
-- The signing state of several signers, the encrypted current link and the Drive state live in documents.data (jsonb), so no
-- column is needed for them; drive_files is the flat record of every file in Drive (one row per upload).

-- ── v2 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.doc_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  kind         text not null default 'custom' check (kind in ('brokerage', 'custom')),
  title        text,
  blocks       jsonb not null default '[]'::jsonb,
  fields       jsonb not null default '[]'::jsonb,
  sections     jsonb not null default '{}'::jsonb,
  logo         jsonb,
  source       jsonb,
  status       text not null default 'active' check (status in ('active', 'archived')),
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.doc_templates enable row level security;
drop trigger if exists doc_templates_touch on public.doc_templates;
create trigger doc_templates_touch before update on public.doc_templates for each row execute function public.afik_documents_touch();
alter table public.documents add column if not exists template_id uuid references public.doc_templates (id) on delete set null;
alter table public.documents add column if not exists template jsonb;
alter table public.documents add column if not exists project_id text;
alter table public.documents add column if not exists project_name text;
alter table public.documents add column if not exists agent_name text;
create index if not exists documents_project_idx on public.documents (project_id);
create index if not exists documents_template_idx on public.documents (template_id);

-- ── v3: Google Drive ─────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.drive_files (
  id            bigserial primary key,
  document_id   uuid references public.documents (id) on delete cascade,
  kind          text not null,                           -- original (the PDF sent) · signed (the signed PDF) · template
  drive_id      text not null,                           -- Google Drive file id
  name          text not null,                           -- [Project]_[Client]_[Type]_[Date]_[Status].pdf
  folder        text,                                    -- Afik HaNahal/Documents/Projects/<project>/Signed Documents
  web_link      text,
  md5           text,
  created_at    timestamptz not null default now()
);
create index if not exists drive_files_doc_idx on public.drive_files (document_id, kind);
alter table public.drive_files enable row level security;
-- the queue reads documents by their Drive state (data.drive.status = pending | error)
create index if not exists documents_drive_status_idx on public.documents ((data -> 'drive' ->> 'status'));
