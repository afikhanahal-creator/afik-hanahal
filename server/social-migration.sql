-- Social inbox (2026-11-03): Messenger + Instagram conversations of the office's pages, kept here so the admin's "סושיאל" tab
-- shows them like WhatsApp and turns a person into a lead in one click. Written only by the server (service key; RLS on, no
-- policies). Every change is announced on the change bus (afik_sync_notify → 'afik-sync', the table and id only).
create table if not exists public.social_threads (
  id          text primary key,                    -- '<platform>:<account id>:<user id>'
  platform    text not null check (platform in ('messenger', 'instagram')),
  account_id  text not null,                       -- the Facebook page id / the Instagram business account id
  user_id     text not null,                       -- PSID / IGSID (the person, scoped to our page)
  name        text,
  username    text,                                -- Instagram @handle
  avatar      text,
  last_text   text,
  last_dir    text check (last_dir in ('in', 'out')),
  last_at     timestamptz,
  unread      integer not null default 0,
  phone       text,                                -- a phone number the person wrote in the chat (05X…)
  email       text,
  lead_id     text,                                -- the CRM lead made from this conversation
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists social_threads_last_at on public.social_threads (last_at desc);

create table if not exists public.social_messages (
  id          text primary key,                    -- Meta's message id (mid)
  thread_id   text not null references public.social_threads (id) on delete cascade,
  direction   text not null check (direction in ('in', 'out')),
  body        text,
  attachments jsonb,
  ts          timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists social_messages_thread_ts on public.social_messages (thread_id, ts);

alter table public.social_threads enable row level security;
alter table public.social_messages enable row level security;

drop trigger if exists afik_sync_social_threads on public.social_threads;
create trigger afik_sync_social_threads after insert or update on public.social_threads for each row execute function public.afik_sync_notify();
