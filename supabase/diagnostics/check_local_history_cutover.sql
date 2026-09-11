-- Diagnostic queries for local-history cutover.
-- Read-only. Do not run destructive statements from this file.

select
  (select count(*) from public.prayer_progress_operations) as operations_total,
  (select count(*) from public.prayer_progress_operations where operation_type = 'complete') as complete_operations,
  (
    select count(*)
    from public.prayer_progress_operations
    where created_at >= timestamptz '2026-09-09T00:00:00Z'
      and created_at < now() - interval '48 hours'
  ) as post_cutover_older_than_48h,
  (select count(*) from public.prayer_progress_operation_items) as operation_items_total,
  (
    select count(*)
    from public.prayer_progress_operation_items oi
    join public.prayer_progress_operations op on op.id = oi.operation_id
    where op.created_at >= now() - interval '1 hour'
  ) as operation_items_last_hour,
  (
    select exists(
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'get_daily_prayer_summary'
    )
  ) as get_daily_prayer_summary_exists,
  (
    select exists(
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'delete_history_operation'
    )
  ) as delete_history_operation_exists,
  (
    select exists(
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'delete_all_history'
    )
  ) as delete_all_history_exists,
  (
    select coalesce(jsonb_agg(p.proname order by p.proname), '[]'::jsonb)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_get_functiondef(p.oid) ilike '%insert into public.prayer_progress_operation_items%'
  ) as functions_inserting_operation_items,
  (
    select pg_size_pretty(pg_total_relation_size('public.prayer_progress_operations'))
  ) as operations_size,
  (
    select pg_size_pretty(pg_total_relation_size('public.prayer_progress_operation_items'))
  ) as operation_items_size,
  (
    select pg_size_pretty(pg_relation_size('public.prayer_progress_operations_user_created_idx'))
  ) as operations_user_created_idx_size,
  (
    select case
      when to_regclass('public.prayer_progress_operations_user_type_created_idx') is null then null
      else pg_size_pretty(pg_relation_size('public.prayer_progress_operations_user_type_created_idx'))
    end
  ) as operations_user_type_created_idx_size,
  (
    select case
      when to_regclass('public.user_prayer_personalizations') is null then 0
      else (select count(*) from public.user_prayer_personalizations)
    end
  ) as personalizations_rows,
  (
    select count(*) from public.user_prayer_inputs
  ) as prayer_inputs_rows;
