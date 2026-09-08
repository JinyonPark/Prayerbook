-- Daily prayer stats, command dedup, and legacy complete backfill.
-- Does not delete auth.users, user_prayer_progress, or legacy complete operations.

create or replace function public.internal_jsonb_counts_valid(p_counts jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(p_counts) = 'object'
    and pg_column_size(p_counts) <= 8192
    and (select count(*) from jsonb_object_keys(p_counts)) <= 64
    and not exists (
      select 1
      from jsonb_each(p_counts) e
      where jsonb_typeof(e.value) <> 'number'
         or (e.value #>> '{}') !~ '^[0-9]+$'
         or (e.value #>> '{}')::bigint < 0
         or char_length(e.key) > 64
    );
$$;

create table if not exists public.user_daily_prayer_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  time_zone text not null,
  total_completion_count integer not null default 0,
  item_counts jsonb not null default '{}'::jsonb,
  first_completed_at timestamptz not null,
  last_completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date),
  constraint user_daily_prayer_stats_total_chk check (total_completion_count >= 0),
  constraint user_daily_prayer_stats_item_object_chk check (jsonb_typeof(item_counts) = 'object'),
  constraint user_daily_prayer_stats_item_valid_chk check (public.internal_jsonb_counts_valid(item_counts))
);

create index if not exists user_daily_prayer_stats_local_date_idx
  on public.user_daily_prayer_stats (local_date);

drop trigger if exists user_daily_prayer_stats_set_updated_at on public.user_daily_prayer_stats;
create trigger user_daily_prayer_stats_set_updated_at
  before update on public.user_daily_prayer_stats
  for each row execute function public.set_updated_at();

alter table public.user_daily_prayer_stats enable row level security;

drop policy if exists "users can read own daily prayer stats" on public.user_daily_prayer_stats;
create policy "users can read own daily prayer stats"
  on public.user_daily_prayer_stats
  for select
  to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.user_daily_prayer_stats from authenticated, anon, public;
grant select on public.user_daily_prayer_stats to authenticated;

create table if not exists public.prayer_command_dedup (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_event_id uuid not null,
  command_type text not null,
  result_json jsonb null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  primary key (user_id, client_event_id),
  constraint prayer_command_dedup_type_chk check (
    command_type in (
      'complete',
      'manual_edit',
      'item_reset',
      'current_round_reset',
      'main_full_reset',
      'all_full_reset',
      'bulk_set'
    )
  ),
  constraint prayer_command_dedup_result_size_chk check (
    result_json is null or pg_column_size(result_json) <= 65536
  )
);

create index if not exists prayer_command_dedup_created_idx
  on public.prayer_command_dedup (created_at);

alter table public.prayer_command_dedup enable row level security;

revoke all on public.prayer_command_dedup from authenticated, anon, public;

create table if not exists public.prayer_storage_backfill_report (
  checked_at timestamptz primary key default now(),
  complete_operations integer not null default 0,
  ops_missing_items integer not null default 0,
  ops_multi_items integer not null default 0,
  unknown_prayer_items integer not null default 0,
  duplicate_client_events integer not null default 0,
  null_users integer not null default 0,
  null_created_at integer not null default 0,
  daily_total_sum integer not null default 0,
  item_count_sum integer not null default 0,
  matched boolean not null default false,
  notes text not null default ''
);

alter table public.prayer_storage_backfill_report enable row level security;
revoke all on public.prayer_storage_backfill_report from authenticated, anon, public;

create or replace function public.internal_user_time_zone(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  select coalesce(nullif(btrim(time_zone), ''), 'Asia/Seoul')
    into v_tz
  from public.user_preferences
  where user_id = p_user_id;

  if v_tz is null then
    v_tz := 'Asia/Seoul';
  end if;

  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    v_tz := 'Asia/Seoul';
  end if;

  return v_tz;
end;
$$;

create or replace function public.internal_apply_daily_complete(
  p_user_id uuid,
  p_prayer_item_id uuid,
  p_completed_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_date date;
  v_key text := p_prayer_item_id::text;
begin
  v_tz := public.internal_user_time_zone(p_user_id);
  v_date := (timezone(v_tz, p_completed_at))::date;

  insert into public.user_daily_prayer_stats (
    user_id,
    local_date,
    time_zone,
    total_completion_count,
    item_counts,
    first_completed_at,
    last_completed_at
  )
  values (
    p_user_id,
    v_date,
    v_tz,
    1,
    jsonb_build_object(v_key, 1),
    p_completed_at,
    p_completed_at
  )
  on conflict (user_id, local_date) do update
  set
    total_completion_count = public.user_daily_prayer_stats.total_completion_count + 1,
    item_counts = jsonb_set(
      public.user_daily_prayer_stats.item_counts,
      array[v_key],
      to_jsonb(coalesce((public.user_daily_prayer_stats.item_counts ->> v_key)::integer, 0) + 1)
    ),
    last_completed_at = greatest(public.user_daily_prayer_stats.last_completed_at, excluded.last_completed_at),
    updated_at = now();
end;
$$;

-- Backfill uses each user's currently stored time zone (Asia/Seoul fallback).
-- Historical timezone changes are not reconstructed.
insert into public.user_daily_prayer_stats (
  user_id,
  local_date,
  time_zone,
  total_completion_count,
  item_counts,
  first_completed_at,
  last_completed_at
)
select
  d.user_id,
  d.local_date,
  d.time_zone,
  d.total_completion_count,
  d.item_counts,
  d.first_completed_at,
  d.last_completed_at
from (
  select
    c.user_id,
    c.local_date,
    min(c.time_zone) as time_zone,
    count(*)::integer as total_completion_count,
    coalesce(jsonb_object_agg(c.prayer_item_id::text, c.item_n) filter (where c.prayer_item_id is not null), '{}'::jsonb) as item_counts,
    min(c.created_at) as first_completed_at,
    max(c.created_at) as last_completed_at
  from (
    select
      x.user_id,
      x.created_at,
      x.time_zone,
      x.local_date,
      x.prayer_item_id,
      count(*) over (partition by x.user_id, x.local_date, x.prayer_item_id) as item_n,
      row_number() over (partition by x.user_id, x.local_date, x.prayer_item_id order by x.created_at) as item_rn
    from (
      select distinct on (op.user_id, op.client_event_id)
        op.user_id,
        op.client_event_id,
        op.created_at,
        oi.prayer_item_id,
        public.internal_user_time_zone(op.user_id) as time_zone,
        (timezone(public.internal_user_time_zone(op.user_id), op.created_at))::date as local_date
      from public.prayer_progress_operations op
      join public.prayer_progress_operation_items oi
        on oi.operation_id = op.id
      join public.prayer_items pi
        on pi.id = oi.prayer_item_id
      where op.operation_type = 'complete'
        and op.user_id is not null
        and op.created_at is not null
      order by op.user_id, op.client_event_id, op.created_at
    ) x
  ) c
  where c.item_rn = 1
  group by c.user_id, c.local_date
) d
on conflict (user_id, local_date) do nothing;

insert into public.prayer_storage_backfill_report (
  complete_operations,
  ops_missing_items,
  ops_multi_items,
  unknown_prayer_items,
  duplicate_client_events,
  null_users,
  null_created_at,
  daily_total_sum,
  item_count_sum,
  matched,
  notes
)
select
  complete_operations,
  ops_missing_items,
  ops_multi_items,
  unknown_prayer_items,
  duplicate_client_events,
  null_users,
  null_created_at,
  daily_total_sum,
  item_count_sum,
  complete_operations = daily_total_sum
    and unknown_prayer_items = 0
    and null_users = 0
    and null_created_at = 0,
  'Backfill uses current user_preferences.time_zone. Legacy complete rows are kept.'
from (
  select
    (
      select count(*)::integer
      from public.prayer_progress_operations
      where operation_type = 'complete'
    ) as complete_operations,
    (
      select count(*)::integer
      from public.prayer_progress_operations op
      where op.operation_type = 'complete'
        and not exists (
          select 1 from public.prayer_progress_operation_items oi where oi.operation_id = op.id
        )
    ) as ops_missing_items,
    (
      select count(*)::integer
      from (
        select oi.operation_id
        from public.prayer_progress_operations op
        join public.prayer_progress_operation_items oi on oi.operation_id = op.id
        where op.operation_type = 'complete'
        group by oi.operation_id
        having count(*) > 1
      ) multi
    ) as ops_multi_items,
    (
      select count(*)::integer
      from public.prayer_progress_operations op
      join public.prayer_progress_operation_items oi on oi.operation_id = op.id
      where op.operation_type = 'complete'
        and not exists (select 1 from public.prayer_items pi where pi.id = oi.prayer_item_id)
    ) as unknown_prayer_items,
    (
      select coalesce(sum(cnt - 1), 0)::integer
      from (
        select count(*) as cnt
        from public.prayer_progress_operations
        where operation_type = 'complete'
        group by user_id, client_event_id
        having count(*) > 1
      ) dups
    ) as duplicate_client_events,
    (
      select count(*)::integer
      from public.prayer_progress_operations
      where operation_type = 'complete' and user_id is null
    ) as null_users,
    (
      select count(*)::integer
      from public.prayer_progress_operations
      where operation_type = 'complete' and created_at is null
    ) as null_created_at,
    (
      select coalesce(sum(total_completion_count), 0)::integer
      from public.user_daily_prayer_stats
    ) as daily_total_sum,
    (
      select coalesce(sum((e.value #>> '{}')::integer), 0)::integer
      from public.user_daily_prayer_stats s
      cross join lateral jsonb_each(s.item_counts) e
    ) as item_count_sum
) stats;

revoke all on function public.internal_jsonb_counts_valid(jsonb) from public, anon, authenticated;
revoke all on function public.internal_user_time_zone(uuid) from public, anon, authenticated;
revoke all on function public.internal_apply_daily_complete(uuid, uuid, timestamptz) from public, anon, authenticated;
