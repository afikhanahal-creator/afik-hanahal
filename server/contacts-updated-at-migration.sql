-- contacts.updated_at: every change to a lead (a note, a rename, a stage, a task, the automations' state) bumps it, so the
-- admin panel's poll can ask for "new OR changed since …" and every open screen / device shows the change.
-- Applied to production on 2026-10-23 (existing rows got that day's time). Safe to run again.
alter table public.contacts add column if not exists updated_at timestamptz not null default now();
create or replace function public.contacts_touch_updated_at() returns trigger language plpgsql set search_path = '' as 'begin new.updated_at := now(); return new; end';
drop trigger if exists contacts_touch_updated_at on public.contacts;
create trigger contacts_touch_updated_at before update on public.contacts for each row execute function public.contacts_touch_updated_at();
create index if not exists contacts_updated_at_idx on public.contacts (updated_at desc);
