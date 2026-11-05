-- Supabase free-plan watch (2026-11-05; safe to re-run). The daily cron (api/cron/warm.js supabaseWatch) reads the two quotas
-- the database can measure itself — the database size (500 MB on the free plan) and the files in Storage (1 GB) — plus how many
-- public files still lack a one-year cache header (each repeat download of those is full egress). Sizes only, never content.
create or replace function public.afik_usage()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
    'storage_files', (select count(*) from storage.objects),
    'short_cache_files', (select count(*) from storage.objects o join storage.buckets b on b.id = o.bucket_id
                          where b.public and coalesce(substring(o.metadata->>'cacheControl' from 'max-age=(\d+)')::bigint, 0) < 86400),
    'short_cache_bytes', coalesce((select sum((o.metadata->>'size')::bigint) from storage.objects o join storage.buckets b on b.id = o.bucket_id
                          where b.public and coalesce(substring(o.metadata->>'cacheControl' from 'max-age=(\d+)')::bigint, 0) < 86400), 0),
    'buckets', (select coalesce(jsonb_object_agg(bucket_id, bytes), '{}'::jsonb) from (select bucket_id, sum((metadata->>'size')::bigint) bytes from storage.objects group by bucket_id) x)
  )
$$;
revoke all on function public.afik_usage() from public, anon, authenticated;
grant execute on function public.afik_usage() to service_role;
