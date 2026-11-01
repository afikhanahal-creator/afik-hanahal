-- "ממתינים לתשובה" (2026-11-01): every chat whose last word is the lead's — the newest message per phone in wa_messages
-- (reactions don't count either way) is incoming. Read by GET /api/meta/chat-waiting; the admin keeps it fresh from the live
-- feed (src/lib/waWaiting.js). Inside Postgres, on the (phone, ts desc) index: one small answer, never the messages.
create or replace function public.afik_wa_waiting(days int default 14)
returns table(phone text, ts timestamptz, type text, body text)
language sql stable security definer set search_path = '' as $fn$
  select l.phone, l.ts, l.type, left(coalesce(l.body, ''), 140)
  from (
    select distinct on (m.phone) m.phone, m.direction, m.ts, m.type, m.body
    from public.wa_messages m
    where m.ts > now() - make_interval(days => greatest(1, least(coalesce(days, 14), 60)))
      and m.type <> 'reactionMessage'
      and m.phone ~ '^[0-9]{9,15}$'
    order by m.phone, m.ts desc
  ) l
  where l.direction = 'in'
  order by l.ts desc
  limit 300
$fn$;
revoke all on function public.afik_wa_waiting(int) from public, anon, authenticated;
grant execute on function public.afik_wa_waiting(int) to service_role;
