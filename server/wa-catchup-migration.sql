-- Phone messages always reach the system (2026-11-01; safe to re-run). Messages written on the office phone's own WhatsApp
-- arrive through Green's webhook (outgoingMessageReceived → wa_messages, by_api = false). Two additions:
--  1. afik_wa_catchup(rows): auto-tick / auto-run read Green's last 3 hours (lastIncomingMessages + lastOutgoingMessages)
--     and insert whatever a missed webhook delivery left out. Unlike afik_wa_backfill it is NOT quiet (updated_at = now(), the
--     change bus is told), so an open chat, the waiting list and the alerts get it like any live message. Existing rows stay.
--  2. afik_wa_last(days): the newest message each way per phone (small), so the automations count a conversation held from
--     the phone (or by hand from the panel): the no-reply clock restarts from our latest message, and a lead we already wrote
--     to is never offered a "missed welcome".
create or replace function public.afik_wa_catchup(rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.wa_messages (id, phone, direction, type, body, file_url, file_name, mime, sender_name, quoted, status, by_api, ts)
  select r.id, r.phone, r.direction, coalesce(r.type, 'textMessage'), r.body, r.file_url, r.file_name, r.mime, r.sender_name, r.quoted, r.status, r.by_api, r.ts
  from jsonb_to_recordset(rows) as r(id text, phone text, direction text, type text, body text, file_url text, file_name text, mime text, sender_name text, quoted jsonb, status text, by_api boolean, ts timestamptz)
  where r.id is not null and r.phone ~ '^[0-9]{8,15}$' and r.direction in ('in', 'out') and r.ts is not null
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.afik_wa_catchup(jsonb) from public, anon, authenticated;
grant execute on function public.afik_wa_catchup(jsonb) to service_role;

create or replace function public.afik_wa_last(days int default 35)
returns table(phone text, last_in timestamptz, last_out timestamptz, last_phone_out timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.phone,
         max(m.ts) filter (where m.direction = 'in'),
         max(m.ts) filter (where m.direction = 'out'),
         max(m.ts) filter (where m.direction = 'out' and m.by_api is false)
  from public.wa_messages m
  where m.ts > now() - make_interval(days => greatest(1, least(days, 90)))
    and m.type <> 'reactionMessage'
  group by m.phone
$$;
revoke all on function public.afik_wa_last(int) from public, anon, authenticated;
grant execute on function public.afik_wa_last(int) to service_role;
