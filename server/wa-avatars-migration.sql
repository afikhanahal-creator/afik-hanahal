-- WhatsApp profile pictures (Green API getAvatar), cached so every screen shows the face of the person in the chat without
-- asking Green again: one row per number. url = WhatsApp's own CDN link (pps.whatsapp.net), it expires (expires_at, from its
-- `oe` parameter); available = false when the person hides their photo. Read and written only by the server (RLS on, no policy).
create table if not exists public.wa_avatars (
  phone       text primary key,
  url         text,
  available   boolean not null default false,
  expires_at  timestamptz,
  checked_at  timestamptz not null default now()
);
alter table public.wa_avatars enable row level security;
