-- One inbox (2026-11-03): the office line's WhatsApp chats next to Messenger / Instagram (admin "תיבת הודעות"). One row per
-- phone from wa_messages: the newest message (reactions left out), how many messages, and how many of theirs came after our
-- last one (= waiting for us). Read by GET /api/meta/social-wa (service key only).
create or replace function public.afik_wa_threads(lim integer default 600)
returns table (phone text, body text, type text, direction text, ts timestamptz, msgs bigint, waiting bigint)
language sql stable security definer set search_path = '' as $$
  with m as (select x.phone, x.body, x.type, x.direction, x.ts from public.wa_messages x where x.type is distinct from 'reactionMessage'),
  agg as (select m.phone, count(*) as n, max(m.ts) filter (where m.direction = 'out') as last_out from m group by m.phone),
  last as (select distinct on (m.phone) m.phone, m.body, m.type, m.direction, m.ts from m order by m.phone, m.ts desc)
  select l.phone, l.body, l.type, l.direction, l.ts, a.n,
         (select count(*) from m where m.phone = l.phone and m.direction = 'in' and (a.last_out is null or m.ts > a.last_out))
  from last l join agg a on a.phone = l.phone
  order by l.ts desc
  limit greatest(1, least(lim, 2000));
$$;
revoke all on function public.afik_wa_threads(integer) from public, anon, authenticated;
grant execute on function public.afik_wa_threads(integer) to service_role;
