-- Lifetime completion totals for share/copy.
-- Does not modify user_prayer_progress completion_count, auth.users, or delete operations.

create table if not exists public.user_prayer_totals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lifetime_completion_count bigint not null default 0,
  first_completed_at timestamptz null,
  last_completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_prayer_totals_lifetime_chk check (lifetime_completion_count >= 0)
);

drop trigger if exists user_prayer_totals_set_updated_at on public.user_prayer_totals;
create trigger user_prayer_totals_set_updated_at
  before update on public.user_prayer_totals
  for each row execute function public.set_updated_at();

alter table public.user_prayer_totals enable row level security;

drop policy if exists "users can read own prayer totals" on public.user_prayer_totals;
create policy "users can read own prayer totals"
  on public.user_prayer_totals
  for select
  to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.user_prayer_totals from authenticated, anon, public;
grant select on public.user_prayer_totals to authenticated;

create or replace function public.internal_apply_lifetime_complete(
  p_user_id uuid,
  p_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_prayer_totals (
    user_id,
    lifetime_completion_count,
    first_completed_at,
    last_completed_at
  )
  values (p_user_id, 1, p_at, p_at)
  on conflict (user_id) do update set
    lifetime_completion_count = public.user_prayer_totals.lifetime_completion_count + 1,
    first_completed_at = coalesce(
      least(public.user_prayer_totals.first_completed_at, excluded.first_completed_at),
      excluded.first_completed_at
    ),
    last_completed_at = greatest(
      public.user_prayer_totals.last_completed_at,
      excluded.last_completed_at
    ),
    updated_at = now();
end;
$$;

revoke all on function public.internal_apply_lifetime_complete(uuid, timestamptz) from public, anon, authenticated;

-- Prefer complete-operation history when present, otherwise daily-stat sums.
-- Do not use current completion_count sums (manual edits and resets change those).
insert into public.user_prayer_totals (
  user_id,
  lifetime_completion_count,
  first_completed_at,
  last_completed_at
)
select
  recovered.user_id,
  recovered.lifetime_completion_count,
  recovered.first_completed_at,
  recovered.last_completed_at
from (
  select
    ids.user_id,
    greatest(coalesce(ops.op_count, 0), coalesce(daily.daily_sum, 0))::bigint as lifetime_completion_count,
    coalesce(daily.first_completed_at, ops.first_completed_at) as first_completed_at,
    coalesce(daily.last_completed_at, ops.last_completed_at) as last_completed_at
  from (
    select user_id from public.user_daily_prayer_stats
    union
    select user_id from public.prayer_progress_operations where operation_type = 'complete' and user_id is not null
  ) ids
  left join (
    select
      op.user_id,
      count(distinct op.client_event_id)::bigint as op_count,
      min(op.created_at) as first_completed_at,
      max(op.created_at) as last_completed_at
    from public.prayer_progress_operations op
    where op.operation_type = 'complete'
      and op.user_id is not null
    group by op.user_id
  ) ops on ops.user_id = ids.user_id
  left join (
    select
      s.user_id,
      sum(s.total_completion_count)::bigint as daily_sum,
      min(s.first_completed_at) as first_completed_at,
      max(s.last_completed_at) as last_completed_at
    from public.user_daily_prayer_stats s
    group by s.user_id
  ) daily on daily.user_id = ids.user_id
) recovered
where recovered.lifetime_completion_count > 0
on conflict (user_id) do nothing;

create or replace function public.complete_prayer(
  prayer_item_id uuid,
  client_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid;
  v_begin jsonb;
  v_item public.prayer_items%rowtype;
  v_after integer;
  v_before integer;
  v_previous_total integer;
  v_snapshot jsonb;
  v_result jsonb;
  v_prayer_item_id uuid := prayer_item_id;
  v_client_event_id uuid := client_event_id;
begin
  v_uid := public.internal_require_user();
  v_begin := public.internal_begin_command(v_uid, v_client_event_id, 'complete');
  if (v_begin->>'claimed')::boolean is not true then
    return (v_begin->'result') || jsonb_build_object('idempotent', true, 'total_changed', false);
  end if;

  select * into v_item
  from public.prayer_items
  where id = v_prayer_item_id
    and is_active = true;

  if not found then
    raise exception 'PRAYER_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

  insert into public.user_prayer_progress (user_id, prayer_item_id, completion_count, updated_at)
  values (v_uid, v_prayer_item_id, 1, now())
  on conflict on constraint user_prayer_progress_pkey
  do update set
    completion_count = public.user_prayer_progress.completion_count + 1,
    updated_at = now()
  returning completion_count into v_after;

  v_before := v_after - 1;
  perform public.internal_apply_daily_complete(v_uid, v_prayer_item_id, now());
  perform public.internal_apply_lifetime_complete(v_uid, now());

  v_snapshot := public.internal_progress_snapshot(v_uid);
  v_result := public.internal_command_result(
    null,
    v_previous_total,
    v_snapshot,
    jsonb_build_array(jsonb_build_object(
      'prayer_item_id', v_prayer_item_id,
      'before_count', v_before,
      'after_count', v_after
    ))
  ) || jsonb_build_object('request_id', v_client_event_id);

  return public.internal_finish_command(v_uid, v_client_event_id, v_result);
end;
$$;

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
  v_row public.user_daily_prayer_stats%rowtype;
  v_result jsonb;
  v_lifetime bigint := 0;
begin
  v_uid := public.internal_require_user();
  v_tz := public.internal_user_time_zone(v_uid);
  v_date := coalesce(target_date, (timezone(v_tz, now()))::date);

  v_lifetime := coalesce((
    select t.lifetime_completion_count
    from public.user_prayer_totals t
    where t.user_id = v_uid
  ), 0);

  select * into v_row
  from public.user_daily_prayer_stats
  where user_id = v_uid
    and local_date = v_date;

  if not found then
    return jsonb_build_object(
      'local_date', v_date,
      'time_zone', v_tz,
      'total_completion_count', 0,
      'unique_prayer_count', 0,
      'main_prayer_completion_count', 0,
      'supplementary_prayer_completion_count', 0,
      'lifetime_completion_count', v_lifetime,
      'items', '[]'::jsonb
    );
  end if;

  with item_rows as (
    select
      pi.id as prayer_item_id,
      pi.title as prayer_title,
      pi.item_number,
      pi.category,
      pi.display_order,
      (e.value #>> '{}')::integer as completion_count
    from jsonb_each(v_row.item_counts) e
    join public.prayer_items pi on pi.id::text = e.key
  )
  select jsonb_build_object(
    'local_date', v_row.local_date,
    'time_zone', v_row.time_zone,
    'total_completion_count', v_row.total_completion_count,
    'unique_prayer_count', (select count(*)::integer from item_rows),
    'main_prayer_completion_count', (
      select coalesce(sum(completion_count), 0)::integer from item_rows where category = 'main'
    ),
    'supplementary_prayer_completion_count', (
      select coalesce(sum(completion_count), 0)::integer from item_rows where category = 'supplementary'
    ),
    'lifetime_completion_count', v_lifetime,
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

revoke all on function public.complete_prayer(uuid, uuid) from public, anon;
revoke all on function public.get_daily_prayer_summary(date) from public, anon;
grant execute on function public.complete_prayer(uuid, uuid) to authenticated;
grant execute on function public.get_daily_prayer_summary(date) to authenticated;
