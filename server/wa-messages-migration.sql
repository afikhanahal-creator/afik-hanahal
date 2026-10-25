-- WhatsApp messages as they happen (applied 2026-10-25; safe to re-run). Green API posts every message — the lead's replies,
-- what the office sends from the system or from the phone — and every delivery status to /api/meta/green-hook
-- (lib/green-hook.js). They are kept here, so a chat opens from our own database in milliseconds instead of waiting ~4 s for
-- Green's getChatHistory, and the insert announces itself on the change bus (afik_sync_notify: the table and the message id
-- only — never a phone or a text) so every open chat shows a reply within a second. The future chatbot answers from here too.
create table if not exists public.wa_messages (
  id          text primary key,                     -- Green's idMessage
  phone       text not null,                        -- 972…, the other side of the chat
  direction   text not null check (direction in ('in', 'out')),
  type        text not null default 'textMessage',  -- Green's typeMessage
  body        text,                                  -- the text or the caption
  file_url    text,
  file_name   text,
  mime        text,
  sender_name text,
  quoted      jsonb,
  status      text,                                  -- out: sent / delivered / read / failed
  by_api      boolean,                               -- out: sent through the system (true) or from the phone (false)
  ts          timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists wa_messages_phone_ts on public.wa_messages (phone, ts desc);
create index if not exists wa_messages_updated on public.wa_messages (updated_at);
alter table public.wa_messages enable row level security;   -- no policies: only the server (service key) reads / writes
drop trigger if exists afik_sync_wa_messages on public.wa_messages;
create trigger afik_sync_wa_messages after insert or update on public.wa_messages for each row execute function public.afik_sync_notify();
-- the key Green signs every delivery with (sent as webhookUrlToken → "Authorization: Bearer …"); made here, never in code or chat
insert into public.app_settings (key, value, updated_at) values ('green_hook_key', to_jsonb(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')), now()) on conflict (key) do nothing;
