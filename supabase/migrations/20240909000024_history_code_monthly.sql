-- History codes, monthly stats, history RPCs, and tighter retention.
-- Does not delete auth.users, user_prayer_progress, legacy complete operations,
-- preferences, reading state, or prayer item ids/slugs.

alter table public.prayer_items
  add column if not exists history_code text;

update public.prayer_items
set history_code = item_number::text
where category = 'main'
  and (history_code is null or history_code = '');

update public.prayer_items
set history_code = case slug
  when 'hope-prayer' then 'wish'
  when 'conceived-prayer' then 'evangelism'
  when 'spiritual-prayer' then 'spiritual'
  else left(regexp_replace(slug, '[^a-z0-9]', '', 'g'), 20)
end
where category = 'supplementary'
  and (history_code is null or history_code = '');

update public.prayer_items
set history_code = left(regexp_replace(coalesce(slug, id::text), '[^a-z0-9]', '', 'g'), 20)
where history_code is null or history_code = '';

alter table public.prayer_items
  alter column history_code set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'prayer_items_history_code_chk'
  ) then
    alter table public.prayer_items
      add constraint prayer_items_history_code_chk
      check (
        char_length(history_code) between 1 and 20
        and history_code ~ '^[a-z0-9]+$'
      );
  end if;
end
$$;

create unique index if not exists prayer_items_history_code_uidx
  on public.prayer_items (history_code);

create or replace function public.internal_fill_history_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.history_code is not null and btrim(old.history_code) <> '' then
    new.history_code := old.history_code;
    return new;
  end if;
  if new.history_code is not null and btrim(new.history_code) <> '' then
    return new;
  end if;
  if new.category = 'main' and new.item_number is not null then
    new.history_code := new.item_number::text;
  elsif new.slug = 'hope-prayer' then
    new.history_code := 'wish';
  elsif new.slug = 'conceived-prayer' then
    new.history_code := 'evangelism';
  elsif new.slug = 'spiritual-prayer' then
    new.history_code := 'spiritual';
  else
    new.history_code := left(regexp_replace(coalesce(new.slug, new.id::text), '[^a-z0-9]', '', 'g'), 20);
  end if;
  return new;
end;
$$;

drop trigger if exists prayer_items_fill_history_code on public.prayer_items;
create trigger prayer_items_fill_history_code
  before insert or update on public.prayer_items
  for each row execute function public.internal_fill_history_code();

update public.user_daily_prayer_stats s
set item_counts = coalesce(n.item_counts, '{}'::jsonb)
from (
  select
    s2.user_id,
    s2.local_date,
    (
      select coalesce(jsonb_object_agg(mapped.code, mapped.total), '{}'::jsonb)
      from (
        select
          pi.history_code as code,
          sum((e.value #>> '{}')::integer)::integer as total
        from jsonb_each(s2.item_counts) e
        join public.prayer_items pi
          on pi.id::text = e.key
          or pi.history_code = e.key
        group by pi.history_code
      ) mapped
    ) as item_counts
  from public.user_daily_prayer_stats s2
) n
where s.user_id = n.user_id
  and s.local_date = n.local_date;

create or replace function public.internal_jsonb_counts_valid(p_counts jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(p_counts) = 'object'
    and pg_column_size(p_counts) <= 8192
    and (select count(*) from jsonb_object_keys(p_counts)) <= 40
    and not exists (
      select 1
      from jsonb_each(p_counts) e
      where jsonb_typeof(e.value) <> 'number'
         or (e.value #>> '{}') !~ '^[0-9]+$'
         or (e.value #>> '{}')::bigint < 0
         or char_length(e.key) > 20
    );
$$;

create or replace function public.internal_jsonb_counts_add(p_left jsonb, p_right jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
  from (
    select e.key, sum((e.value #>> '{}')::integer)::integer as v
    from (
      select key, value from jsonb_each(coalesce(p_left, '{}'::jsonb))
      union all
      select key, value from jsonb_each(coalesce(p_right, '{}'::jsonb))
    ) e
    group by e.key
  ) s(k, v);
$$;

create table if not exists public.user_monthly_prayer_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  total_completion_count bigint not null default 0,
  item_counts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, month_start),
  constraint user_monthly_prayer_stats_month_chk check (date_trunc('month', month_start)::date = month_start),
  constraint user_monthly_prayer_stats_total_chk check (total_completion_count >= 0),
  constraint user_monthly_prayer_stats_item_object_chk check (jsonb_typeof(item_counts) = 'object'),
  constraint user_monthly_prayer_stats_item_valid_chk check (public.internal_jsonb_counts_valid(item_counts))
);

create index if not exists user_monthly_prayer_stats_month_start_idx
  on public.user_monthly_prayer_stats (month_start);

drop trigger if exists user_monthly_prayer_stats_set_updated_at on public.user_monthly_prayer_stats;
create trigger user_monthly_prayer_stats_set_updated_at
  before update on public.user_monthly_prayer_stats
  for each row execute function public.set_updated_at();

alter table public.user_monthly_prayer_stats enable row level security;

drop policy if exists "users can read own monthly prayer stats" on public.user_monthly_prayer_stats;
create policy "users can read own monthly prayer stats"
  on public.user_monthly_prayer_stats
  for select
  to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.user_monthly_prayer_stats from authenticated, anon, public;
grant select on public.user_monthly_prayer_stats to authenticated;

create or replace function public.internal_assert_history_count_keys()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from jsonb_object_keys(new.item_counts) k
    where not exists (
      select 1 from public.prayer_items pi where pi.history_code = k
    )
  ) then
    raise exception 'INVALID_HISTORY_CODE' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists user_daily_prayer_stats_history_keys on public.user_daily_prayer_stats;
create trigger user_daily_prayer_stats_history_keys
  before insert or update on public.user_daily_prayer_stats
  for each row execute function public.internal_assert_history_count_keys();

drop trigger if exists user_monthly_prayer_stats_history_keys on public.user_monthly_prayer_stats;
create trigger user_monthly_prayer_stats_history_keys
  before insert or update on public.user_monthly_prayer_stats
  for each row execute function public.internal_assert_history_count_keys();

insert into public.user_monthly_prayer_stats (
  user_id,
  month_start,
  total_completion_count,
  item_counts
)
select
  t.user_id,
  t.month_start,
  t.total_completion_count,
  coalesce((
    select jsonb_object_agg(i.code, i.total)
    from (
      select
        date_trunc('month', s.local_date)::date as month_start,
        s.user_id,
        e.key as code,
        sum((e.value #>> '{}')::integer)::integer as total
      from public.user_daily_prayer_stats s
      cross join lateral jsonb_each(s.item_counts) e
      group by s.user_id, date_trunc('month', s.local_date)::date, e.key
    ) i
    where i.user_id = t.user_id
      and i.month_start = t.month_start
  ), '{}'::jsonb)
from (
  select
    user_id,
    date_trunc('month', local_date)::date as month_start,
    sum(total_completion_count)::bigint as total_completion_count
  from public.user_daily_prayer_stats
  group by user_id, date_trunc('month', local_date)::date
) t
on conflict (user_id, month_start) do update set
  total_completion_count = excluded.total_completion_count,
  item_counts = excluded.item_counts,
  updated_at = now();

insert into public.user_monthly_prayer_stats (
  user_id,
  month_start,
  total_completion_count,
  item_counts
)
select
  grouped.user_id,
  grouped.month_start,
  grouped.total_completion_count,
  grouped.item_counts
from (
  select
    legacy.user_id,
    legacy.month_start,
    sum(legacy.item_total)::bigint as total_completion_count,
    jsonb_object_agg(legacy.history_code, legacy.item_total) as item_counts
  from (
    select
      dated.user_id,
      date_trunc('month', dated.local_date)::date as month_start,
      dated.history_code,
      count(*)::integer as item_total
    from (
      select
        once.user_id,
        (timezone(public.internal_user_time_zone(once.user_id), once.created_at))::date as local_date,
        once.history_code
      from (
        select
          op.user_id,
          op.created_at,
          pi.history_code,
          row_number() over (
            partition by op.user_id, coalesce(op.client_event_id, op.id)
            order by oi.prayer_item_id
          ) as rn
        from public.prayer_progress_operations op
        join public.prayer_progress_operation_items oi on oi.operation_id = op.id
        join public.prayer_items pi on pi.id = oi.prayer_item_id
        where op.operation_type = 'complete'
          and op.user_id is not null
      ) once
      where once.rn = 1
    ) dated
    where not exists (
      select 1
      from public.user_daily_prayer_stats s
      where s.user_id = dated.user_id
        and s.local_date = dated.local_date
    )
    group by dated.user_id, date_trunc('month', dated.local_date)::date, dated.history_code
  ) legacy
  group by legacy.user_id, legacy.month_start
) grouped
on conflict (user_id, month_start) do update set
  total_completion_count = public.user_monthly_prayer_stats.total_completion_count + excluded.total_completion_count,
  item_counts = public.internal_jsonb_counts_add(
    public.user_monthly_prayer_stats.item_counts,
    excluded.item_counts
  ),
  updated_at = now();

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
    and daily_total_sum = monthly_total_sum
    and unknown_prayer_items = 0,
  format(
    'history_code monthly backfill. complete_ops=%s daily=%s monthly=%s lifetime=%s. Legacy complete rows kept.',
    complete_operations,
    daily_total_sum,
    monthly_total_sum,
    lifetime_sum
  )
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
    ) as item_count_sum,
    (
      select coalesce(sum(total_completion_count), 0)::bigint
      from public.user_monthly_prayer_stats
    ) as monthly_total_sum,
    (
      select coalesce(sum(lifetime_completion_count), 0)::bigint
      from public.user_prayer_totals
    ) as lifetime_sum
) stats;

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
  v_key text;
begin
  select history_code into v_key
  from public.prayer_items
  where id = p_prayer_item_id;

  if v_key is null then
    raise exception 'PRAYER_NOT_FOUND' using errcode = 'P0002';
  end if;

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

create or replace function public.internal_apply_monthly_complete(
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
  v_month date;
  v_key text;
begin
  select history_code into v_key
  from public.prayer_items
  where id = p_prayer_item_id;

  if v_key is null then
    raise exception 'PRAYER_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_tz := public.internal_user_time_zone(p_user_id);
  v_month := date_trunc('month', (timezone(v_tz, p_completed_at))::date)::date;

  insert into public.user_monthly_prayer_stats (
    user_id,
    month_start,
    total_completion_count,
    item_counts
  )
  values (
    p_user_id,
    v_month,
    1,
    jsonb_build_object(v_key, 1)
  )
  on conflict (user_id, month_start) do update
  set
    total_completion_count = public.user_monthly_prayer_stats.total_completion_count + 1,
    item_counts = jsonb_set(
      public.user_monthly_prayer_stats.item_counts,
      array[v_key],
      to_jsonb(coalesce((public.user_monthly_prayer_stats.item_counts ->> v_key)::integer, 0) + 1)
    ),
    updated_at = now();
end;
$$;

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
  v_metrics jsonb;
  v_result jsonb;
  v_prayer_item_id uuid := prayer_item_id;
  v_client_event_id uuid := client_event_id;
  v_tz text;
  v_date date;
  v_today integer := 0;
  v_today_unique integer := 0;
  v_lifetime bigint := 0;
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

  if not found or v_item.history_code is null then
    raise exception 'PRAYER_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_previous_total := public.internal_total_completed(v_uid);

  insert into public.user_prayer_progress (user_id, prayer_item_id, completion_count, updated_at)
  values (v_uid, v_prayer_item_id, 1, now())
  on conflict on constraint user_prayer_progress_pkey
  do update set
    completion_count = public.user_prayer_progress.completion_count + 1,
    updated_at = now()
  returning completion_count into v_after;

  v_before := v_after - 1;
  perform public.internal_apply_daily_complete(v_uid, v_prayer_item_id, now());
  perform public.internal_apply_monthly_complete(v_uid, v_prayer_item_id, now());
  perform public.internal_apply_lifetime_complete(v_uid, now());

  v_metrics := public.internal_progress_metrics(v_uid);
  v_tz := public.internal_user_time_zone(v_uid);
  v_date := (timezone(v_tz, now()))::date;

  select
    coalesce(s.total_completion_count, 0),
    coalesce((select count(*)::integer from jsonb_each(s.item_counts) e where (e.value #>> '{}')::integer > 0), 0)
  into v_today, v_today_unique
  from public.user_daily_prayer_stats s
  where s.user_id = v_uid
    and s.local_date = v_date;

  v_today := coalesce(v_today, 0);
  v_today_unique := coalesce(v_today_unique, 0);

  v_lifetime := coalesce((
    select t.lifetime_completion_count
    from public.user_prayer_totals t
    where t.user_id = v_uid
  ), 0);

  v_result := v_metrics || jsonb_build_object(
    'prayer_item_id', v_prayer_item_id,
    'history_code', v_item.history_code,
    'completion_count', v_after,
    'previous_count', v_before,
    'previous_total', v_previous_total,
    'current_total', (v_metrics->>'total_completed')::integer,
    'total_changed', (v_metrics->>'total_completed')::integer is distinct from v_previous_total,
    'operation_id', null,
    'request_id', v_client_event_id,
    'affected_items', jsonb_build_array(jsonb_build_object(
      'prayer_item_id', v_prayer_item_id,
      'before_count', v_before,
      'after_count', v_after
    )),
    'today_completion_count', v_today,
    'today_unique_prayer_count', v_today_unique,
    'lifetime_completion_count', v_lifetime
  );

  return public.internal_finish_command(v_uid, v_client_event_id, v_result);
end;
$$;

create or replace function public.internal_history_items_from_counts(p_counts jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'history_code', pi.history_code,
        'prayer_item_id', pi.id,
        'item_number', pi.item_number,
        'title', pi.title,
        'category', pi.category,
        'completion_count', (e.value #>> '{}')::integer
      )
      order by
        case when pi.category = 'main' then coalesce(pi.item_number, 1000) else 1000 end,
        pi.display_order
    ),
    '[]'::jsonb
  )
  from jsonb_each(coalesce(p_counts, '{}'::jsonb)) e
  join public.prayer_items pi on pi.history_code = e.key
  where (e.value #>> '{}')::integer > 0;
$$;

create or replace function public.get_recent_prayer_history(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_tz text;
  v_today date;
  v_days integer;
begin
  v_uid := public.internal_require_user();
  v_days := least(greatest(coalesce(p_days, 30), 1), 31);
  v_tz := public.internal_user_time_zone(v_uid);
  v_today := (timezone(v_tz, now()))::date;

  return coalesce((
    select jsonb_agg(row_json order by local_date desc)
    from (
      select
        s.local_date,
        jsonb_build_object(
          'local_date', s.local_date,
          'total_completion_count', s.total_completion_count,
          'unique_prayer_count', coalesce((
            select count(*)::integer
            from jsonb_each(s.item_counts) e
            where (e.value #>> '{}')::integer > 0
          ), 0),
          'items', public.internal_history_items_from_counts(s.item_counts)
        ) as row_json
      from public.user_daily_prayer_stats s
      where s.user_id = v_uid
        and s.local_date >= v_today - (v_days - 1)
        and s.local_date <= v_today
      order by s.local_date desc
      limit 31
    ) listed
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_monthly_prayer_history(p_months integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_tz text;
  v_month date;
  v_months integer;
begin
  v_uid := public.internal_require_user();
  v_months := least(greatest(coalesce(p_months, 12), 1), 12);
  v_tz := public.internal_user_time_zone(v_uid);
  v_month := date_trunc('month', (timezone(v_tz, now()))::date)::date;

  return coalesce((
    select jsonb_agg(row_json order by month_start desc)
    from (
      select
        s.month_start,
        jsonb_build_object(
          'month_start', s.month_start,
          'total_completion_count', s.total_completion_count,
          'unique_prayer_count', coalesce((
            select count(*)::integer
            from jsonb_each(s.item_counts) e
            where (e.value #>> '{}')::integer > 0
          ), 0),
          'items', public.internal_history_items_from_counts(s.item_counts)
        ) as row_json
      from public.user_monthly_prayer_stats s
      where s.user_id = v_uid
        and s.month_start >= (v_month - make_interval(months => v_months - 1))::date
        and s.month_start <= v_month
      order by s.month_start desc
      limit 12
    ) listed
  ), '[]'::jsonb);
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
    join public.prayer_items pi on pi.history_code = e.key
  )
  select jsonb_build_object(
    'local_date', v_row.local_date,
    'time_zone', v_tz,
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

create or replace function public.purge_prayer_history_storage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily integer := 0;
  v_monthly integer := 0;
  v_dedup integer := 0;
  v_ops integer := 0;
  v_items integer := 0;
  v_batch integer := 0;
begin
  if auth.uid() is not null then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  loop
    with doomed as (
      select s.user_id, s.local_date
      from public.user_daily_prayer_stats s
      where s.local_date < ((timezone(public.internal_user_time_zone(s.user_id), now()))::date - 29)
      limit 5000
    )
    delete from public.user_daily_prayer_stats d
    using doomed
    where d.user_id = doomed.user_id
      and d.local_date = doomed.local_date;
    get diagnostics v_batch = row_count;
    v_daily := v_daily + v_batch;
    exit when v_batch = 0;
  end loop;

  loop
    with doomed as (
      select s.user_id, s.month_start
      from public.user_monthly_prayer_stats s
      where s.month_start < (
        date_trunc(
          'month',
          (timezone(public.internal_user_time_zone(s.user_id), now()))::date
        )::date - interval '11 months'
      )::date
      limit 5000
    )
    delete from public.user_monthly_prayer_stats d
    using doomed
    where d.user_id = doomed.user_id
      and d.month_start = doomed.month_start;
    get diagnostics v_batch = row_count;
    v_monthly := v_monthly + v_batch;
    exit when v_batch = 0;
  end loop;

  loop
    delete from public.prayer_command_dedup
    where ctid in (
      select ctid
      from public.prayer_command_dedup
      where created_at < now() - interval '48 hours'
      limit 5000
    );
    get diagnostics v_batch = row_count;
    v_dedup := v_dedup + v_batch;
    exit when v_batch = 0;
  end loop;

  loop
    delete from public.prayer_progress_operation_items oi
    using public.prayer_progress_operations op
    where oi.operation_id = op.id
      and op.operation_type <> 'complete'
      and op.created_at < now() - interval '90 days'
      and oi.ctid in (
        select oi2.ctid
        from public.prayer_progress_operation_items oi2
        join public.prayer_progress_operations op2 on op2.id = oi2.operation_id
        where op2.operation_type <> 'complete'
          and op2.created_at < now() - interval '90 days'
        limit 5000
      );
    get diagnostics v_batch = row_count;
    v_items := v_items + v_batch;
    exit when v_batch = 0;
  end loop;

  loop
    delete from public.prayer_progress_operations
    where ctid in (
      select ctid
      from public.prayer_progress_operations
      where operation_type <> 'complete'
        and created_at < now() - interval '90 days'
      limit 5000
    );
    get diagnostics v_batch = row_count;
    v_ops := v_ops + v_batch;
    exit when v_batch = 0;
  end loop;

  return jsonb_build_object(
    'deleted_daily_rows', v_daily,
    'deleted_monthly_rows', v_monthly,
    'deleted_dedup_rows', v_dedup,
    'deleted_audit_operations', v_ops,
    'deleted_audit_items', v_items
  );
end;
$$;

create or replace function public.purge_prayer_storage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.purge_prayer_history_storage();
end;
$$;

create or replace function public.reset_all_prayers(client_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_begin jsonb;
  v_previous_total integer;
  v_op_id uuid;
  v_snapshot jsonb;
  v_result jsonb;
  v_client_event_id uuid := client_event_id;
  v_changed integer := 0;
  v_daily_rows integer := 0;
  v_monthly_rows integer := 0;
  v_lifetime bigint := 0;
begin
  v_uid := public.internal_require_user();
  v_begin := public.internal_begin_command(v_uid, v_client_event_id, 'all_full_reset');
  if (v_begin->>'claimed')::boolean is not true then
    return (v_begin->'result') || jsonb_build_object('idempotent', true, 'total_changed', false);
  end if;

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

  select count(*)::integer into v_changed
  from public.user_prayer_progress
  where user_id = v_uid
    and completion_count > 0;

  select count(*)::integer into v_daily_rows
  from public.user_daily_prayer_stats
  where user_id = v_uid;

  select count(*)::integer into v_monthly_rows
  from public.user_monthly_prayer_stats
  where user_id = v_uid;

  v_lifetime := coalesce((
    select t.lifetime_completion_count
    from public.user_prayer_totals t
    where t.user_id = v_uid
  ), 0);

  if v_changed = 0 and v_daily_rows = 0 and v_monthly_rows = 0 and v_lifetime = 0 then
    v_snapshot := public.internal_progress_snapshot(v_uid);
    v_result := public.internal_command_result(null, v_previous_total, v_snapshot, '[]'::jsonb)
      || jsonb_build_object('request_id', v_client_event_id);
    return public.internal_finish_command(v_uid, v_client_event_id, v_result);
  end if;

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, v_client_event_id, 'all_full_reset')
  returning id into v_op_id;

  if v_changed > 0 then
    insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
    select v_op_id, prayer_item_id, completion_count, 0
    from public.user_prayer_progress
    where user_id = v_uid
      and completion_count > 0;

    delete from public.user_prayer_progress
    where user_id = v_uid;
  end if;

  delete from public.user_daily_prayer_stats
  where user_id = v_uid;

  delete from public.user_monthly_prayer_stats
  where user_id = v_uid;

  insert into public.user_prayer_totals (
    user_id,
    lifetime_completion_count,
    first_completed_at,
    last_completed_at
  )
  values (v_uid, 0, null, null)
  on conflict (user_id) do update set
    lifetime_completion_count = 0,
    first_completed_at = null,
    last_completed_at = null,
    updated_at = now();

  v_snapshot := public.internal_progress_snapshot(v_uid);
  v_result := public.internal_command_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('request_id', v_client_event_id);
  return public.internal_finish_command(v_uid, v_client_event_id, v_result);
end;
$$;

revoke all on function public.internal_apply_daily_complete(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.internal_apply_monthly_complete(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.internal_history_items_from_counts(jsonb) from public, anon, authenticated;
revoke all on function public.internal_fill_history_code() from public, anon, authenticated;
revoke all on function public.internal_jsonb_counts_add(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.internal_assert_history_count_keys() from public, anon, authenticated;
revoke all on function public.purge_prayer_history_storage() from public, anon, authenticated;
revoke all on function public.purge_prayer_storage() from public, anon, authenticated;
revoke all on function public.complete_prayer(uuid, uuid) from public, anon;
revoke all on function public.get_daily_prayer_summary(date) from public, anon;
revoke all on function public.get_recent_prayer_history(integer) from public, anon;
revoke all on function public.get_monthly_prayer_history(integer) from public, anon;
revoke all on function public.reset_all_prayers(uuid) from public, anon;

grant execute on function public.complete_prayer(uuid, uuid) to authenticated;
grant execute on function public.get_daily_prayer_summary(date) to authenticated;
grant execute on function public.get_recent_prayer_history(integer) to authenticated;
grant execute on function public.get_monthly_prayer_history(integer) to authenticated;
grant execute on function public.reset_all_prayers(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.purge_prayer_history_storage() to service_role;
    grant execute on function public.purge_prayer_storage() to service_role;
  end if;
end
$$;

notify pgrst, 'reload schema';
