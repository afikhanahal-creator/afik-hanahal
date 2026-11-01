-- Paced bulk sends (2026-11-01): the database's own scheduler sends the next message of a bulk send (one a minute, at most).
-- It counts the jobs whose next message is due — app_settings.automations_jobs, status scheduled / sending, `at` and `nextAt`
-- passed — inside Postgres (no transfer, no function call) and only then calls /api/meta/auto-jobs-tick with the key the
-- database made for the reminders (app_settings.remind_key). Outside the sending hours / after a day's cap the server moves
-- `nextAt` ahead, so nothing is called at night. Run after server/sync-bus-migration.sql.
create or replace function public.afik_due_jobs() returns integer language sql stable security definer set search_path = '' as $fn$
select count(*)::int
from public.app_settings s
cross join lateral jsonb_array_elements(case when jsonb_typeof(s.value->'jobs') = 'array' then s.value->'jobs' else '[]'::jsonb end) j
where s.key = 'automations_jobs'
  and j->>'status' in ('scheduled', 'sending')
  and (j->>'at')::timestamptz <= now()
  and coalesce(nullif(j->>'nextAt', ''), j->>'at')::timestamptz <= now()
$fn$;
revoke all on function public.afik_due_jobs() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'afik-bulk-jobs';
select cron.schedule('afik-bulk-jobs', '* * * * *', 'select net.http_post(url := ''https://www.afikhanahal.co.il/api/meta/auto-jobs-tick'', body := jsonb_build_object(''key'', (select value#>>''{}'' from public.app_settings where key = ''remind_key'')), headers := ''{"Content-Type":"application/json"}''::jsonb, timeout_milliseconds := 25000) where public.afik_due_jobs() > 0');
