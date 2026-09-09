-- History storage diagnostics. Read-only. Do not write or complete prayers here.

select pg_database_size(current_database()) as database_bytes;

select
  c.relname as table_name,
  c.reltuples::bigint as estimate_rows,
  pg_relation_size(c.oid) as data_bytes,
  pg_indexes_size(c.oid) as index_bytes,
  pg_total_relation_size(c.oid) as total_bytes
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'user_daily_prayer_stats',
    'user_monthly_prayer_stats',
    'user_prayer_totals',
    'prayer_command_dedup',
    'prayer_progress_operations',
    'prayer_progress_operation_items',
    'user_prayer_progress'
  )
order by c.relname;

select count(*) as daily_rows from public.user_daily_prayer_stats;
select count(*) as monthly_rows from public.user_monthly_prayer_stats;
select count(*) as dedup_rows from public.prayer_command_dedup;
select count(*) as audit_operations
from public.prayer_progress_operations
where operation_type <> 'complete';

select coalesce(avg(pg_column_size(item_counts)), 0) as daily_item_counts_avg_bytes
from public.user_daily_prayer_stats;

select coalesce(avg(pg_column_size(item_counts)), 0) as monthly_item_counts_avg_bytes
from public.user_monthly_prayer_stats;

select count(distinct user_id) as dau_30d
from public.user_daily_prayer_stats
where local_date >= ((timezone('Asia/Seoul', now()))::date - 30);

select coalesce(avg(row_count), 0) as avg_daily_rows_per_user
from (
  select user_id, count(*) as row_count
  from public.user_daily_prayer_stats
  group by user_id
) t;

select coalesce(avg(row_count), 0) as avg_monthly_rows_per_user
from (
  select user_id, count(*) as row_count
  from public.user_monthly_prayer_stats
  group by user_id
) t;

select count(*) as daily_rows_older_than_30d
from public.user_daily_prayer_stats
where local_date < ((timezone('Asia/Seoul', now()))::date - 29);

select count(*) as monthly_rows_older_than_12m
from public.user_monthly_prayer_stats
where month_start < (date_trunc('month', (timezone('Asia/Seoul', now()))::date) - interval '11 months')::date;
