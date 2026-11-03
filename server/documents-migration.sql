-- Documents & digital signatures (admin "מסמכים וחתימות", 2026-11-03): the brokerage-order documents the office creates, sends
-- and gets signed. Written only by the server (service key; RLS on, no policies). The client's private link is kept as a hash
-- (never the token), the one-time code as a hash with its expiry and tries. Every step is an event in document_events — a
-- hash chain (each row's hash covers the previous one), which the signed PDF's certificate page prints. The files (the PDF
-- sent for signing, the drawn signature, the signed PDF) live in the private storage bucket "documents", served only through
-- signed URLs the API makes. Changes to documents are announced on the change bus (afik_sync_notify), so the open admin
-- refreshes by itself.
create extension if not exists pgcrypto;

create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  number         text not null unique,                    -- AH-2026-0001
  type           text not null default 'brokerage',
  template_version integer not null default 1,
  status         text not null default 'draft' check (status in ('draft','sent','opened','signed','expired','cancelled','failed')),
  lead_id        text,                                    -- contacts.id of the CRM lead (text, like social_threads)
  property_id    text,
  client_name    text,
  client_phone   text,                                    -- 05X… (for search)
  client_email   text,
  data           jsonb not null default '{}'::jsonb,      -- { client, property, fees, agent, logo, terms, expiryDays, title }
  clauses        jsonb,                                   -- the template's clauses as they were when the document was sent (frozen)
  token_hash     text,                                    -- sha256 of the signing token in the private link
  otp_hash       text,
  otp_expires    timestamptz,
  otp_tries      integer not null default 0,
  otp_via        text,
  expires_at     timestamptz,
  sent_at        timestamptz,
  opened_at      timestamptz,
  signed_at      timestamptz,
  signature      jsonb,                                   -- { name, idNumber, at, via, to, ip, ua }
  original_path  text,                                    -- storage: the PDF sent for signing
  original_hash  text,                                    -- sha256 of that PDF
  signature_path text,                                    -- storage: the drawn signature (PNG)
  signed_path    text,                                    -- storage: the signed PDF (with the certificate page)
  signed_hash    text,
  send_log       jsonb not null default '[]'::jsonb,      -- [{ at, via, to, ok, error }]
  notified_at    timestamptz,                             -- the office's WhatsApp + email after the signature (idempotent)
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists documents_status_idx on public.documents (status, created_at desc);
create index if not exists documents_lead_idx on public.documents (lead_id);
create index if not exists documents_token_idx on public.documents (token_hash);
create index if not exists documents_phone_idx on public.documents (client_phone);

create table if not exists public.document_events (
  id            bigserial primary key,
  document_id   uuid not null references public.documents (id) on delete cascade,
  type          text not null,                            -- created · updated · sent_whatsapp · sent_email · send_failed · opened · otp_sent · otp_failed · verified · signed · copy_sent · office_notified · cancelled · expired · resent · link_renewed · downloaded
  at            timestamptz not null default now(),
  ip            text,
  ua            text,
  meta          jsonb,
  hash          text not null                             -- sha256(previous hash | this event)
);
create index if not exists document_events_doc_idx on public.document_events (document_id, id);

alter table public.documents enable row level security;
alter table public.document_events enable row level security;

create or replace function public.afik_documents_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists documents_touch on public.documents;
create trigger documents_touch before update on public.documents for each row execute function public.afik_documents_touch();

-- the change bus (server/sync-bus-migration.sql): the open admin re-reads the list when a document changes
do $$ begin
  if exists (select 1 from pg_proc where proname = 'afik_sync_notify') then
    execute 'drop trigger if exists afik_sync_documents on public.documents';
    execute 'create trigger afik_sync_documents after insert or update or delete on public.documents for each row execute function public.afik_sync_notify()';
  end if;
end $$;

-- the private bucket for the files (the API makes signed URLs; nothing public)
insert into storage.buckets (id, name, public, file_size_limit)
  values ('documents', 'documents', false, 26214400)
  on conflict (id) do nothing;
