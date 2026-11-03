-- Documents v2 (2026-11-04): templates from uploaded files (Word / PDF / scans → blocks with {FIELD} placeholders + the
-- template's own fields), a document's template and project, the office's custom field values. Written only by the
-- server (service key; RLS on, no policies). The built-in brokerage order is rendered from the clauses in
-- app_settings.doc_templates (as before) when a document has no template_id.
create table if not exists public.doc_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  kind         text not null default 'custom' check (kind in ('brokerage', 'custom')),
  title        text,
  blocks       jsonb not null default '[]'::jsonb,       -- [{ t: h | p | clause, title?, text }] with {FIELD} placeholders
  fields       jsonb not null default '[]'::jsonb,       -- [{ key, label, type, required, default, options? }]
  sections     jsonb not null default '{}'::jsonb,       -- { parties, property, fees, signatures }
  logo         jsonb,
  source       jsonb,                                    -- { name, path (storage), type, method, pages } of the uploaded file
  status       text not null default 'active' check (status in ('active', 'archived')),
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.doc_templates enable row level security;
drop trigger if exists doc_templates_touch on public.doc_templates;
create trigger doc_templates_touch before update on public.doc_templates for each row execute function public.afik_documents_touch();

alter table public.documents add column if not exists template_id uuid references public.doc_templates (id) on delete set null;
alter table public.documents add column if not exists template jsonb;          -- the template as it was when the document was sent (frozen)
alter table public.documents add column if not exists project_id text;
alter table public.documents add column if not exists project_name text;
alter table public.documents add column if not exists agent_name text;
create index if not exists documents_project_idx on public.documents (project_id);
create index if not exists documents_template_idx on public.documents (template_id);
