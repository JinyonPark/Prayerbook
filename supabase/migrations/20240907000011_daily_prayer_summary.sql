-- Additive daily prayer activity summary.
-- Does not modify user_prayer_progress completion counts, auth.users, or existing operations.

alter table public.user_preferences
  add column if not exists time_zone text not null default 'Asia/Seoul';

create index if not exists prayer_progress_operations_user_type_created_idx
  on public.prayer_progress_operations (user_id, operation_type, created_at desc);

create or replace function public.get_daily_prayer_summary(target_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_tz text;
  v_date date;
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  v_uid := public.internal_require_user(); -- always auth.uid(); no user_id argument

  select coalesce(nullif(btrim(time_zone), ''), 'Asia/Seoul')
    into v_tz
  from public.user_preferences
  where user_id = v_uid;

  if v_tz is null then
    v_tz := 'Asia/Seoul';
  end if;

  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    v_tz := 'Asia/Seoul';
  end if;

  v_date := coalesce(target_date, (timezone(v_tz, now()))::date);
  v_start := v_date::timestamp at time zone v_tz;
  v_end := (v_date + 1)::timestamp at time zone v_tz;

  with completes as (
    select distinct on (op.client_event_id)
      op.id,
      op.client_event_id
    from public.prayer_progress_operations op
    where op.user_id = v_uid
      and op.operation_type = 'complete'
      and op.created_at >= v_start
      and op.created_at < v_end
    order by op.client_event_id, op.created_at
  ),
  item_rows as (
    select
      oi.prayer_item_id,
      pi.title as prayer_title,
      pi.item_number,
      pi.category,
      pi.display_order,
      count(*)::integer as completion_count
    from completes c
    join public.prayer_progress_operation_items oi on oi.operation_id = c.id
    join public.prayer_items pi on pi.id = oi.prayer_item_id
    group by oi.prayer_item_id, pi.title, pi.item_number, pi.category, pi.display_order
  )
  select jsonb_build_object(
    'local_date', v_date,
    'time_zone', v_tz,
    'total_completion_count', (select count(*)::integer from completes),
    'unique_prayer_count', (select count(*)::integer from item_rows),
    'main_prayer_completion_count', (
      select coalesce(sum(completion_count), 0)::integer from item_rows where category = 'main'
    ),
    'supplementary_prayer_completion_count', (
      select coalesce(sum(completion_count), 0)::integer from item_rows where category = 'supplementary'
    ),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'prayer_item_id', prayer_item_id,
          'prayer_title', prayer_title,
          'item_number', item_number,
          'category', category,
          'completion_count', completion_count
        )
        order by display_order
      )
      from item_rows
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_daily_prayer_summary(date) from public, anon;
grant execute on function public.get_daily_prayer_summary(date) to authenticated;
