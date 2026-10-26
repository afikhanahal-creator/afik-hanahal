-- Chat history backfill (applied 2026-10-26; safe to re-run). Every chat read through Green's getChatHistory fills in the
-- messages wa_messages missed (from before the webhook, or one it dropped) through afik_wa_backfill(rows), so the next
-- open of that chat — any screen, any device — comes straight from our table in milliseconds (POST /api/meta/chat-history
-- {stored:true}). The backfill is quiet: the change bus isn't told (afik.quiet), and updated_at = the message's own time,
-- so the open screens' live feed (chat-updates since <cursor>) never re-sends old messages. Existing rows are left alone.
create or replace function public.afik_wa_backfill(rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform set_config('afik.quiet', '1', true);
  insert into public.wa_messages (id, phone, direction, type, body, file_url, file_name, mime, sender_name, quoted, status, by_api, ts, created_at, updated_at)
  select r.id, r.phone, r.direction, coalesce(r.type, 'textMessage'), r.body, r.file_url, r.file_name, r.mime, r.sender_name, r.quoted, r.status, r.by_api, r.ts, r.ts, r.ts
  from jsonb_to_recordset(rows) as r(id text, phone text, direction text, type text, body text, file_url text, file_name text, mime text, sender_name text, quoted jsonb, status text, by_api boolean, ts timestamptz)
  where r.id is not null and r.phone ~ '^[0-9]{8,15}$' and r.direction in ('in', 'out') and r.ts is not null
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  perform set_config('afik.quiet', '', true);
  return n;
end $$;
revoke all on function public.afik_wa_backfill(jsonb) from public, anon, authenticated;
grant execute on function public.afik_wa_backfill(jsonb) to service_role;
drop trigger if exists afik_sync_wa_messages on public.wa_messages;
create trigger afik_sync_wa_messages after insert or update on public.wa_messages for each row
  when (coalesce(current_setting('afik.quiet', true), '') <> '1') execute function public.afik_sync_notify();
