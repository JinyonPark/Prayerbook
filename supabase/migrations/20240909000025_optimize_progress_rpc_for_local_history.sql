-- Optimize progress RPCs for device-local today/lifetime/history.
-- Does not add tables or data columns.
-- Does not delete auth.users, completion_count, reading state, preferences, or legacy complete rows.
-- Stops new prayer_progress_operation_items writes and daily/monthly/lifetime share-table writes.

create or replace function public.internal_insert_changed_item(
  p_operation_id uuid,
  p_prayer_item_id uuid,
  p_before integer,
  p_after integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Local history no longer stores per-change detail rows.
  return;
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
  v_previous_total integer;
  v_metrics jsonb;
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

  v_previous_total := public.internal_total_completed(v_uid);

  insert into public.user_prayer_progress (user_id, prayer_item_id, completion_count, updated_at)
  values (v_uid, v_prayer_item_id, 1, now())
  on conflict on constraint user_prayer_progress_pkey
  do update set
    completion_count = public.user_prayer_progress.completion_count + 1,
    updated_at = now()
  returning completion_count into v_after;

  v_metrics := public.internal_progress_metrics(v_uid);
  v_result := v_metrics || jsonb_build_object(
    'prayer_item_id', v_prayer_item_id,
    'completion_count', v_after,
    'total_completed', (v_metrics->>'total_completed')::integer,
    'current_round', (v_metrics->>'current_round')::integer,
    'current_completed_count', (v_metrics->>'current_completed_count')::integer,
    'eligible_count', (v_metrics->>'eligible_count')::integer,
    'progress_percent', (v_metrics->>'progress_percent')::numeric,
    'previous_total', v_previous_total,
    'current_total', (v_metrics->>'total_completed')::integer,
    'total_changed', (v_metrics->>'total_completed')::integer is distinct from v_previous_total,
    'request_id', v_client_event_id,
    'operation_id', null,
    'idempotent', false
  );

  return public.internal_finish_command(v_uid, v_client_event_id, v_result);
end;
$$;

create or replace function public.get_home_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := public.internal_require_user();
  return jsonb_build_object(
    'progress', public.internal_progress_snapshot(v_uid)
  );
end;
$$;

create or replace function public.get_legacy_complete_bootstrap(p_cutover timestamptz)
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
  v_cutover timestamptz;
  v_complete integer := 0;
  v_today_count integer := 0;
  v_days jsonb := '[]'::jsonb;
begin
  v_uid := public.internal_require_user();
  v_tz := public.internal_user_time_zone(v_uid);
  v_today := (timezone(v_tz, now()))::date;
  v_cutover := coalesce(p_cutover, now());

  select count(*)::integer
    into v_complete
  from (
    select distinct client_event_id
    from public.prayer_progress_operations
    where user_id = v_uid
      and operation_type = 'complete'
      and created_at < v_cutover
  ) c;

  select count(*)::integer
    into v_today_count
  from (
    select distinct client_event_id
    from public.prayer_progress_operations
    where user_id = v_uid
      and operation_type = 'complete'
      and created_at < v_cutover
      and (timezone(v_tz, created_at))::date = v_today
  ) t;

  select coalesce(jsonb_agg(day_row order by local_date desc), '[]'::jsonb)
    into v_days
  from (
    select
      local_date,
      jsonb_build_object(
        'local_date', local_date,
        'item_counts', jsonb_object_agg(prayer_item_id, item_total)
      ) as day_row
    from (
      select
        (timezone(v_tz, op.created_at))::date as local_date,
        oi.prayer_item_id::text as prayer_item_id,
        count(*)::integer as item_total
      from public.prayer_progress_operations op
      join public.prayer_progress_operation_items oi on oi.operation_id = op.id
      where op.user_id = v_uid
        and op.operation_type = 'complete'
        and op.created_at < v_cutover
        and (timezone(v_tz, op.created_at))::date >= v_today - 29
        and (timezone(v_tz, op.created_at))::date <= v_today
      group by 1, 2
    ) counts
    group by local_date
  ) listed;

  return jsonb_build_object(
    'complete_count', v_complete,
    'today_count', v_today_count,
    'days', v_days
  );
end;
$$;

create or replace function public.set_prayer_count(
  prayer_item_id uuid,
  new_count integer,
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
  v_before integer;
  v_previous_total integer;
  v_op_id uuid;
  v_snapshot jsonb;
  v_result jsonb;
  v_prayer_item_id uuid := prayer_item_id;
  v_client_event_id uuid := client_event_id;
  v_new_count integer := new_count;
begin
  v_uid := public.internal_require_user();
  v_begin := public.internal_begin_command(v_uid, v_client_event_id, 'manual_edit');
  if (v_begin->>'claimed')::boolean is not true then
    return (v_begin->'result') || jsonb_build_object('idempotent', true, 'total_changed', false);
  end if;

  if v_new_count is null or v_new_count < 0 or v_new_count > 10000 or v_new_count <> trunc(v_new_count) then
    raise exception 'INVALID_COUNT' using errcode = '22023';
  end if;

  select * into v_item
  from public.prayer_items
  where id = v_prayer_item_id
    and is_active = true;
  if not found then
    raise exception 'PRAYER_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_previous_total := public.internal_total_completed(v_uid);

  select upp.completion_count into v_before
  from public.user_prayer_progress upp
  where upp.user_id = v_uid
    and upp.prayer_item_id = v_prayer_item_id
  for update;
  if not found then
    v_before := 0;
  end if;

  if v_before = v_new_count then
    v_snapshot := public.internal_progress_snapshot(v_uid);
    v_result := public.internal_command_result(null, v_previous_total, v_snapshot, '[]'::jsonb)
      || jsonb_build_object('request_id', v_client_event_id);
    return public.internal_finish_command(v_uid, v_client_event_id, v_result);
  end if;

  perform public.internal_upsert_count(v_uid, v_prayer_item_id, v_new_count);

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, v_client_event_id, 'manual_edit')
  on conflict (user_id, client_event_id)
  do nothing
  returning id into v_op_id;

  v_snapshot := public.internal_progress_snapshot(v_uid);
  v_result := public.internal_command_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('request_id', v_client_event_id);
  return public.internal_finish_command(v_uid, v_client_event_id, v_result);
end;
$$;

create or replace function public.reset_prayer_item(
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
  v_before integer;
  v_previous_total integer;
  v_op_id uuid;
  v_snapshot jsonb;
  v_result jsonb;
  v_prayer_item_id uuid := prayer_item_id;
  v_client_event_id uuid := client_event_id;
begin
  v_uid := public.internal_require_user();
  v_begin := public.internal_begin_command(v_uid, v_client_event_id, 'item_reset');
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

  v_previous_total := public.internal_total_completed(v_uid);

  select upp.completion_count into v_before
  from public.user_prayer_progress upp
  where upp.user_id = v_uid
    and upp.prayer_item_id = v_prayer_item_id
  for update;
  if not found then
    v_before := 0;
  end if;

  if v_before = 0 then
    v_snapshot := public.internal_progress_snapshot(v_uid);
    v_result := public.internal_command_result(null, v_previous_total, v_snapshot, '[]'::jsonb)
      || jsonb_build_object('request_id', v_client_event_id);
    return public.internal_finish_command(v_uid, v_client_event_id, v_result);
  end if;

  perform public.internal_upsert_count(v_uid, v_prayer_item_id, 0);

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, v_client_event_id, 'item_reset')
  on conflict (user_id, client_event_id)
  do nothing
  returning id into v_op_id;

  v_snapshot := public.internal_progress_snapshot(v_uid);
  v_result := public.internal_command_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('request_id', v_client_event_id);
  return public.internal_finish_command(v_uid, v_client_event_id, v_result);
end;
$$;

create or replace function public.reset_current_round(client_event_id uuid)
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
begin
  v_uid := public.internal_require_user();
  v_begin := public.internal_begin_command(v_uid, v_client_event_id, 'current_round_reset');
  if (v_begin->>'claimed')::boolean is not true then
    return (v_begin->'result') || jsonb_build_object('idempotent', true, 'total_changed', false);
  end if;

  v_previous_total := public.internal_total_completed(v_uid);

  with locked as (
    select upp.prayer_item_id, upp.completion_count
    from public.user_prayer_progress upp
    where upp.user_id = v_uid
      and upp.prayer_item_id in (select e.prayer_item_id from public.internal_eligible_main_prayers(v_uid) e)
      and upp.completion_count > v_previous_total
    for update of upp
  )
  select count(*)::integer into v_changed from locked;

  if v_changed = 0 then
    v_snapshot := public.internal_progress_snapshot(v_uid);
    v_result := public.internal_command_result(null, v_previous_total, v_snapshot, '[]'::jsonb)
      || jsonb_build_object('request_id', v_client_event_id);
    return public.internal_finish_command(v_uid, v_client_event_id, v_result);
  end if;

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, v_client_event_id, 'current_round_reset')
  on conflict (user_id, client_event_id)
  do nothing
  returning id into v_op_id;

  update public.user_prayer_progress upp
  set completion_count = v_previous_total,
      updated_at = now()
  where upp.user_id = v_uid
    and upp.prayer_item_id in (select e.prayer_item_id from public.internal_eligible_main_prayers(v_uid) e)
    and upp.completion_count > v_previous_total;

  v_snapshot := public.internal_progress_snapshot(v_uid);
  v_result := public.internal_command_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('request_id', v_client_event_id);
  return public.internal_finish_command(v_uid, v_client_event_id, v_result);
end;
$$;

create or replace function public.reset_main_prayers(client_event_id uuid)
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
begin
  v_uid := public.internal_require_user();
  v_begin := public.internal_begin_command(v_uid, v_client_event_id, 'main_full_reset');
  if (v_begin->>'claimed')::boolean is not true then
    return (v_begin->'result') || jsonb_build_object('idempotent', true, 'total_changed', false);
  end if;

  v_previous_total := public.internal_total_completed(v_uid);

  select count(*)::integer into v_changed
  from public.user_prayer_progress upp
  join public.prayer_items pi on pi.id = upp.prayer_item_id
  where upp.user_id = v_uid
    and pi.category = 'main'
    and pi.is_active = true
    and upp.completion_count > 0;

  if v_changed = 0 then
    v_snapshot := public.internal_progress_snapshot(v_uid);
    v_result := public.internal_command_result(null, v_previous_total, v_snapshot, '[]'::jsonb)
      || jsonb_build_object('request_id', v_client_event_id);
    return public.internal_finish_command(v_uid, v_client_event_id, v_result);
  end if;

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, v_client_event_id, 'main_full_reset')
  on conflict (user_id, client_event_id)
  do nothing
  returning id into v_op_id;

  delete from public.user_prayer_progress upp
  using public.prayer_items pi
  where upp.user_id = v_uid
    and upp.prayer_item_id = pi.id
    and pi.category = 'main'
    and pi.is_active = true;

  v_snapshot := public.internal_progress_snapshot(v_uid);
  v_result := public.internal_command_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('request_id', v_client_event_id);
  return public.internal_finish_command(v_uid, v_client_event_id, v_result);
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
begin
  v_uid := public.internal_require_user();
  v_begin := public.internal_begin_command(v_uid, v_client_event_id, 'all_full_reset');
  if (v_begin->>'claimed')::boolean is not true then
    return (v_begin->'result') || jsonb_build_object('idempotent', true, 'total_changed', false);
  end if;

  v_previous_total := public.internal_total_completed(v_uid);

  select count(*)::integer into v_changed
  from public.user_prayer_progress
  where user_id = v_uid
    and completion_count > 0;

  if v_changed = 0 then
    v_snapshot := public.internal_progress_snapshot(v_uid);
    v_result := public.internal_command_result(null, v_previous_total, v_snapshot, '[]'::jsonb)
      || jsonb_build_object('request_id', v_client_event_id);
    return public.internal_finish_command(v_uid, v_client_event_id, v_result);
  end if;

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, v_client_event_id, 'all_full_reset')
  on conflict (user_id, client_event_id)
  do nothing
  returning id into v_op_id;

  delete from public.user_prayer_progress
  where user_id = v_uid;

  v_snapshot := public.internal_progress_snapshot(v_uid);
  v_result := public.internal_command_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('request_id', v_client_event_id);
  return public.internal_finish_command(v_uid, v_client_event_id, v_result);
end;
$$;

create or replace function public.bulk_set_main_prayer_count(
  new_count integer,
  client_event_id uuid
)
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
  v_new_count integer := new_count;
  v_changed integer := 0;
begin
  v_uid := public.internal_require_user();
  v_begin := public.internal_begin_command(v_uid, v_client_event_id, 'bulk_set');
  if (v_begin->>'claimed')::boolean is not true then
    return (v_begin->'result') || jsonb_build_object('idempotent', true, 'total_changed', false);
  end if;

  if v_new_count is null or v_new_count < 0 or v_new_count > 10000 or v_new_count <> trunc(v_new_count) then
    raise exception 'INVALID_COUNT' using errcode = '22023';
  end if;

  v_previous_total := public.internal_total_completed(v_uid);

  select count(*)::integer into v_changed
  from public.prayer_items pi
  left join public.user_prayer_progress upp
    on upp.prayer_item_id = pi.id
   and upp.user_id = v_uid
  where pi.category = 'main'
    and pi.is_active = true
    and coalesce(upp.completion_count, 0) is distinct from v_new_count
    and not (v_new_count = 0 and upp.prayer_item_id is null);

  if v_changed = 0 then
    v_snapshot := public.internal_progress_snapshot(v_uid);
    v_result := public.internal_command_result(null, v_previous_total, v_snapshot, '[]'::jsonb)
      || jsonb_build_object('request_id', v_client_event_id);
    return public.internal_finish_command(v_uid, v_client_event_id, v_result);
  end if;

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, v_client_event_id, 'bulk_set')
  on conflict (user_id, client_event_id)
  do nothing
  returning id into v_op_id;

  if v_new_count = 0 then
    delete from public.user_prayer_progress upp
    using public.prayer_items pi
    where upp.user_id = v_uid
      and upp.prayer_item_id = pi.id
      and pi.category = 'main'
      and pi.is_active = true;
  else
    insert into public.user_prayer_progress (user_id, prayer_item_id, completion_count, updated_at)
    select v_uid, pi.id, v_new_count, now()
    from public.prayer_items pi
    where pi.category = 'main'
      and pi.is_active = true
    on conflict on constraint user_prayer_progress_pkey
    do update set
      completion_count = excluded.completion_count,
      updated_at = now();
  end if;

  v_snapshot := public.internal_progress_snapshot(v_uid);
  v_result := public.internal_command_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('request_id', v_client_event_id);
  return public.internal_finish_command(v_uid, v_client_event_id, v_result);
end;
$$;

create or replace function public.purge_short_lived_prayer_operations(
  p_cutover timestamptz,
  p_limit integer default 1000
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 5000);
  v_deleted integer := 0;
begin
  delete from public.prayer_progress_operations
  where id in (
    select id
    from public.prayer_progress_operations
    where created_at >= p_cutover
      and created_at < now() - interval '48 hours'
    order by created_at
    limit v_limit
  );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.internal_insert_changed_item(uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_prayer(uuid, uuid) from public, anon;
revoke all on function public.get_home_dashboard_summary() from public, anon;
revoke all on function public.get_legacy_complete_bootstrap(timestamptz) from public, anon;
revoke all on function public.set_prayer_count(uuid, integer, uuid) from public, anon;
revoke all on function public.reset_prayer_item(uuid, uuid) from public, anon;
revoke all on function public.reset_current_round(uuid) from public, anon;
revoke all on function public.reset_main_prayers(uuid) from public, anon;
revoke all on function public.reset_all_prayers(uuid) from public, anon;
revoke all on function public.bulk_set_main_prayer_count(integer, uuid) from public, anon;
revoke all on function public.purge_short_lived_prayer_operations(timestamptz, integer) from public, anon, authenticated;

grant execute on function public.complete_prayer(uuid, uuid) to authenticated;
grant execute on function public.get_home_dashboard_summary() to authenticated;
grant execute on function public.get_legacy_complete_bootstrap(timestamptz) to authenticated;
grant execute on function public.set_prayer_count(uuid, integer, uuid) to authenticated;
grant execute on function public.reset_prayer_item(uuid, uuid) to authenticated;
grant execute on function public.reset_current_round(uuid) to authenticated;
grant execute on function public.reset_main_prayers(uuid) to authenticated;
grant execute on function public.reset_all_prayers(uuid) to authenticated;
grant execute on function public.bulk_set_main_prayer_count(integer, uuid) to authenticated;
grant execute on function public.purge_short_lived_prayer_operations(timestamptz, integer) to service_role;

notify pgrst, 'reload schema';
