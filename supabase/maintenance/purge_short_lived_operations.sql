-- Purge post-cutover prayer_progress_operations older than 48 hours.
-- Does NOT delete pre-cutover complete rows needed for IndexedDB bootstrap.
-- Not scheduled automatically. Run in batches.

-- Preconditions:
-- 1. New app is deployed and uses IndexedDB for today/lifetime/history.
-- 2. complete_prayer no longer writes operation items.
-- 3. Existing-user bootstrap has been verified.

do $$
declare
  v_cutover timestamptz := timestamptz '2026-09-09T00:00:00Z';
  v_deleted integer := 0;
begin
  if pg_get_functiondef('public.complete_prayer(uuid,uuid)'::regprocedure) ilike '%prayer_progress_operation_items%'
     and pg_get_functiondef('public.complete_prayer(uuid,uuid)'::regprocedure) ilike '%insert into public.prayer_progress_operation_items%' then
    raise exception 'complete_prayer still inserts operation items; aborting purge';
  end if;

  v_deleted := public.purge_short_lived_prayer_operations(v_cutover, 1000);
  raise notice 'purged % post-cutover operation rows', v_deleted;
end;
$$;
