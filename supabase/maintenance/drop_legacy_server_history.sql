-- FINAL cleanup of legacy server history. Do NOT run as an automatic migration.
-- Do NOT run until:
-- 1. New PWA is deployed
-- 2. Frontend no longer calls get_daily_prayer_summary / delete_history_* / operation items
-- 3. Existing-user IndexedDB bootstrap is verified
-- 4. Old PWA clients are no longer calling these functions
-- 5. A database backup exists

do $$
begin
  if pg_get_functiondef('public.complete_prayer(uuid,uuid)'::regprocedure) ilike '%insert into public.prayer_progress_operation_items%' then
    raise exception 'complete_prayer still inserts operation items';
  end if;

  if pg_get_functiondef('public.set_prayer_count(uuid,integer,uuid)'::regprocedure) ilike '%insert into public.prayer_progress_operation_items%' then
    raise exception 'set_prayer_count still inserts operation items';
  end if;

  if pg_get_functiondef('public.reset_current_round(uuid)'::regprocedure) ilike '%insert into public.prayer_progress_operation_items%' then
    raise exception 'reset_current_round still inserts operation items';
  end if;

  if to_regprocedure('public.get_legacy_complete_bootstrap(timestamptz)') is null then
    raise exception 'bootstrap function missing; keep operation items until bootstrap is verified';
  end if;
end;
$$;

-- Drop leftover history RPCs used only by old clients.
drop function if exists public.get_daily_prayer_summary(date);
drop function if exists public.delete_history_operation(uuid);
drop function if exists public.delete_all_history();
drop function if exists public.get_recent_prayer_history(integer);
drop function if exists public.get_monthly_prayer_history(integer);

drop index if exists public.prayer_progress_operations_user_type_created_idx;

drop table if exists public.prayer_progress_operation_items;

-- Optional later, after confirming unused:
-- drop table if exists public.user_daily_prayer_stats;
-- drop table if exists public.user_monthly_prayer_stats;
-- drop table if exists public.user_prayer_totals;
-- drop function if exists public.get_legacy_complete_bootstrap(timestamptz);
