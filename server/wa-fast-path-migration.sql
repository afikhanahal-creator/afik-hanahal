-- WhatsApp fast path (2026-11-04; safe to re-run). One round trip per webhook delivery, and a sent message is in the table
-- the moment Green accepts it — before Green's own webhook about it arrives (~2 s later).
--
-- afik_wa_put(row, src):
--   src = 'send'  — written by the server right after Green accepted a message it sent (lib/automations.js sendText): the
--                   row is inserted when missing and never changes a row that is already there (the webhook may have won).
--   src = 'hook'  — Green's webhook (api/meta.js handleGreenHook): Green's own description of the message wins (type, text,
--                   file, quote, time, sender), but the delivery status only ever moves forward (sent → delivered → read →
--                   played; failed always counts) and an unchanged row is not touched (no needless change-bus event).
-- afik_wa_status(id, status): the status webhook in one statement — moves forward only, a missing row is left alone.
-- Both announce themselves on the change bus through the existing trigger (afik_sync_wa_messages).

create or replace function public.afik_wa_rank(s text) returns integer language sql immutable as $$
  select case s when 'failed' then -1 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 when 'played' then 4 else 0 end
$$;

create or replace function public.afik_wa_put(r jsonb, src text default 'hook')
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if r->>'id' is null or coalesce(r->>'phone', '') !~ '^[0-9]{8,15}$' or r->>'direction' not in ('in', 'out') then return 0; end if;
  if src = 'send' then
    insert into public.wa_messages (id, phone, direction, type, body, file_url, file_name, mime, sender_name, quoted, status, by_api, ts)
    values (r->>'id', r->>'phone', r->>'direction', coalesce(r->>'type', 'textMessage'), r->>'body', r->>'file_url', r->>'file_name',
            r->>'mime', r->>'sender_name', r->'quoted', r->>'status', (r->>'by_api')::boolean, coalesce((r->>'ts')::timestamptz, now()))
    on conflict (id) do nothing;
  else
    insert into public.wa_messages as w (id, phone, direction, type, body, file_url, file_name, mime, sender_name, quoted, status, by_api, ts)
    values (r->>'id', r->>'phone', r->>'direction', coalesce(r->>'type', 'textMessage'), r->>'body', r->>'file_url', r->>'file_name',
            r->>'mime', r->>'sender_name', r->'quoted', r->>'status', (r->>'by_api')::boolean, coalesce((r->>'ts')::timestamptz, now()))
    on conflict (id) do update set
      type        = excluded.type,
      body        = coalesce(excluded.body, w.body),
      file_url    = coalesce(excluded.file_url, w.file_url),
      file_name   = coalesce(excluded.file_name, w.file_name),
      mime        = coalesce(excluded.mime, w.mime),
      sender_name = coalesce(excluded.sender_name, w.sender_name),
      quoted      = coalesce(excluded.quoted, w.quoted),
      by_api      = coalesce(excluded.by_api, w.by_api),
      ts          = excluded.ts,
      status      = case when excluded.status = 'failed' or public.afik_wa_rank(excluded.status) > public.afik_wa_rank(w.status) then excluded.status else w.status end,
      updated_at  = now()
    where (w.type, w.body, w.file_url, w.file_name, w.mime, w.sender_name, w.quoted, w.by_api, w.ts, w.status)
      is distinct from
          (excluded.type, coalesce(excluded.body, w.body), coalesce(excluded.file_url, w.file_url), coalesce(excluded.file_name, w.file_name),
           coalesce(excluded.mime, w.mime), coalesce(excluded.sender_name, w.sender_name), coalesce(excluded.quoted, w.quoted),
           coalesce(excluded.by_api, w.by_api), excluded.ts,
           case when excluded.status = 'failed' or public.afik_wa_rank(excluded.status) > public.afik_wa_rank(w.status) then excluded.status else w.status end);
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.afik_wa_status(mid text, st text)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.wa_messages set status = st, updated_at = now()
  where id = mid and status is distinct from st and (st = 'failed' or public.afik_wa_rank(st) > public.afik_wa_rank(status));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.afik_wa_put(jsonb, text) from public, anon, authenticated;
revoke all on function public.afik_wa_status(text, text) from public, anon, authenticated;
grant execute on function public.afik_wa_put(jsonb, text) to service_role;
grant execute on function public.afik_wa_status(text, text) to service_role;
