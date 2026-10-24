-- The change bus + the follow-up reminder clock, both inside the database (applied to production on 2026-10-23; safe to re-run).
--
-- 1. Every insert / update / delete on contacts, meta_leads and seller_submissions sends a Supabase Realtime broadcast on the
--    public channel 'afik-sync' with the table, the row id and the operation only (never a name, phone or note). The admin
--    (src/lib/syncBus.js) fetches just that change, so no screen polls while the bus is up.
create or replace function public.afik_sync_notify() returns trigger language plpgsql security definer set search_path = '' as 'begin begin perform realtime.send(jsonb_build_object(''t'', TG_TABLE_NAME, ''id'', coalesce(new.id::text, old.id::text), ''op'', TG_OP), ''change'', ''afik-sync'', false); exception when others then null; end; return null; end';
drop trigger if exists afik_sync_contacts on public.contacts;
create trigger afik_sync_contacts after insert or update or delete on public.contacts for each row execute function public.afik_sync_notify();
drop trigger if exists afik_sync_meta_leads on public.meta_leads;
create trigger afik_sync_meta_leads after insert or update or delete on public.meta_leads for each row execute function public.afik_sync_notify();
drop trigger if exists afik_sync_seller_submissions on public.seller_submissions;
create trigger afik_sync_seller_submissions after insert or update or delete on public.seller_submissions for each row execute function public.afik_sync_notify();

-- 2. Follow-up reminders (lib/follow-up.js): pg_cron counts the due ones every minute inside Postgres (no transfer, no
--    function call) and only when there is one calls /api/meta/auto-remind with a key the database made itself
--    (app_settings.remind_key — it never appears in the code or a chat).
create extension if not exists pg_net;
create extension if not exists pg_cron;
insert into public.app_settings (key, value, updated_at) values ('remind_key', to_jsonb(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')), now()) on conflict (key) do nothing;
-- every task with a reminder (follow-ups and plain tasks), its due time read as ISO, or Israel-local for old values (2026-10-24)
create or replace function public.afik_due_reminders() returns integer language sql stable security definer set search_path = '' as $fn$
select count(*)::int
from public.contacts c
cross join lateral jsonb_array_elements(case when jsonb_typeof(c.crm_data->'tasks') = 'array' then c.crm_data->'tasks' else '[]'::jsonb end) t
cross join lateral (select case
  when (t->>'due') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$' then (t->>'due')::timestamptz
  when (t->>'due') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then ((t->>'due')::timestamp at time zone 'Asia/Jerusalem')
  when (t->>'due') ~ '^\d{4}-\d{2}-\d{2}$' then (((t->>'due') || 'T09:00')::timestamp at time zone 'Asia/Jerusalem')
end as due) d
where coalesce(t->>'remind', 'false') = 'true'
  and coalesce(t->>'done', 'false') <> 'true'
  and coalesce(t->>'remindedAt', '') = ''
  and coalesce(t->>'remindGaveUp', 'false') <> 'true'
  and d.due between now() - interval '24 hours' and now()
$fn$;
revoke all on function public.afik_due_reminders() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname in ('afik-reminders', 'afik-cron-cleanup');
select cron.schedule('afik-reminders', '* * * * *', 'select net.http_post(url := ''https://www.afikhanahal.co.il/api/meta/auto-remind'', body := jsonb_build_object(''key'', (select value#>>''{}'' from public.app_settings where key = ''remind_key'')), headers := ''{"Content-Type":"application/json"}''::jsonb, timeout_milliseconds := 25000) where public.afik_due_reminders() > 0');
select cron.schedule('afik-cron-cleanup', '17 3 * * *', 'delete from cron.job_run_details where end_time < now() - interval ''2 days''');
