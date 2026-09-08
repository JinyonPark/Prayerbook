-- Rewrite mutation RPCs: dedup table, no complete audit rows, eligible current-round reset.
-- Does not delete legacy complete operations or change existing completion_count except via RPC definitions.

create or replace function public.internal_eligible_main_prayers(p_user_id uuid)
returns table (
  prayer_item_id uuid,
  item_number smallint,
  display_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select pi.id, pi.item_number, pi.display_order
  from public.prayer_items pi
  left join public.user_preferences pref on pref.user_id = p_user_id
  where pi.category = 'main'
    and pi.is_active = true
    and pi.counts_toward_total = true
    and (
      pref.spouse_prayer_selection is null
      or (pref.spouse_prayer_selection = 'husband' and pi.item_number is distinct from 10)
      or (pref.spouse_prayer_selection = 'wife' and pi.item_number is distinct from 9)
    );
$$;

create or replace function public.internal_progress_snapshot(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_round integer;
  v_completed integer;
  v_main_n integer;
  v_items jsonb;
  v_spouse text;
begin
  select spouse_prayer_selection
    into v_spouse
  from public.user_preferences
  where user_id = p_user_id;

  select coalesce(min(coalesce(upp.completion_count, 0)), 0)
    into v_total
  from public.internal_eligible_main_prayers(p_user_id) e
  left join public.user_prayer_progress upp
    on upp.prayer_item_id = e.prayer_item_id
   and upp.user_id = p_user_id;

  v_round := v_total + 1;

  select count(*)::integer
    into v_completed
  from public.internal_eligible_main_prayers(p_user_id) e
  left join public.user_prayer_progress upp
    on upp.prayer_item_id = e.prayer_item_id
   and upp.user_id = p_user_id
  where coalesce(upp.completion_count, 0) >= v_round;

  select count(*)::integer
    into v_main_n
  from public.internal_eligible_main_prayers(p_user_id);

  select coalesce(jsonb_agg(item_row order by display_order), '[]'::jsonb)
    into v_items
  from (
    select jsonb_build_object(
      'prayer_item_id', pi.id,
      'slug', pi.slug,
      'title', pi.title,
      'item_number', pi.item_number,
      'category', pi.category,
      'counts_toward_total', pi.counts_toward_total,
      'display_order', pi.display_order,
      'completion_count', coalesce(upp.completion_count, 0),
      'excluded_from_progress',
        case
          when pi.category = 'main' and v_spouse = 'husband' and pi.item_number = 10 then true
          when pi.category = 'main' and v_spouse = 'wife' and pi.item_number = 9 then true
          else false
        end,
      'is_completed_in_current_round',
        case
          when pi.category <> 'main' then null
          when pi.category = 'main' and v_spouse = 'husband' and pi.item_number = 10 then null
          when pi.category = 'main' and v_spouse = 'wife' and pi.item_number = 9 then null
          else coalesce(upp.completion_count, 0) >= v_round
        end
    ) as item_row,
    pi.display_order
    from public.prayer_items pi
    left join public.user_prayer_progress upp
      on upp.prayer_item_id = pi.id
     and upp.user_id = p_user_id
    where pi.is_active = true
  ) listed;

  return jsonb_build_object(
    'total_completed', v_total,
    'current_round', v_round,
    'current_completed_count', v_completed,
    'progress_percent', case when v_main_n = 0 then 0 else (v_completed::numeric / v_main_n) * 100 end,
    'eligible_count', v_main_n,
    'spouse_prayer_selection', to_jsonb(v_spouse),
    'items', v_items
  );
end;
$$;

create or replace function public.internal_command_result(
  p_operation_id uuid,
  p_previous_total integer,
  p_snapshot jsonb,
  p_affected jsonb default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_items jsonb;
begin
  v_current := (p_snapshot->>'total_completed')::integer;
  if p_affected is not null then
    v_items := p_affected;
  elsif p_operation_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'prayer_item_id', oi.prayer_item_id,
      'before_count', oi.before_count,
      'after_count', oi.after_count
    )), '[]'::jsonb)
      into v_items
    from public.prayer_progress_operation_items oi
    where oi.operation_id = p_operation_id;
  else
    v_items := '[]'::jsonb;
  end if;

  return p_snapshot || jsonb_build_object(
    'operation_id', to_jsonb(p_operation_id),
    'affected_items', v_items,
    'total_changed', v_current <> p_previous_total,
    'previous_total', p_previous_total,
    'current_total', v_current
  );
end;
$$;

create or replace function public.internal_begin_command(
  p_user_id uuid,
  p_client_event_id uuid,
  p_command_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted uuid;
  v_result jsonb;
begin
  if p_client_event_id is null then
    raise exception 'INVALID_CLIENT_EVENT' using errcode = '22023';
  end if;

  insert into public.prayer_command_dedup (user_id, client_event_id, command_type)
  values (p_user_id, p_client_event_id, p_command_type)
  on conflict (user_id, client_event_id) do nothing
  returning client_event_id into v_inserted;

  if v_inserted is not null then
    return jsonb_build_object('claimed', true);
  end if;

  select result_json
    into v_result
  from public.prayer_command_dedup
  where user_id = p_user_id
    and client_event_id = p_client_event_id
  for update;

  if v_result is not null then
    return jsonb_build_object('claimed', false, 'result', v_result);
  end if;

  raise exception 'COMMAND_IN_PROGRESS' using errcode = '55P03';
end;
$$;

create or replace function public.internal_finish_command(
  p_user_id uuid,
  p_client_event_id uuid,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stored jsonb;
begin
  v_stored := p_result || jsonb_build_object('idempotent', false);
  update public.prayer_command_dedup
  set result_json = v_stored,
      completed_at = now()
  where user_id = p_user_id
    and client_event_id = p_client_event_id;
  return v_stored;
end;
$$;

create or replace function public.internal_upsert_count(
  p_user_id uuid,
  p_prayer_item_id uuid,
  p_new_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_new_count < 0 or p_new_count > 10000 then
    raise exception 'INVALID_COUNT' using errcode = '22023';
  end if;

  if p_new_count = 0 then
    delete from public.user_prayer_progress
    where user_id = p_user_id
      and prayer_item_id = p_prayer_item_id;
    return;
  end if;

  insert into public.user_prayer_progress (user_id, prayer_item_id, completion_count, updated_at)
  values (p_user_id, p_prayer_item_id, p_new_count, now())
  on conflict (user_id, prayer_item_id)
  do update set
    completion_count = excluded.completion_count,
    updated_at = now();
end;
$$;

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
  if p_before is not distinct from p_after then
    return;
  end if;
  insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
  values (p_operation_id, p_prayer_item_id, p_before, p_after);
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

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

  select completion_count into v_before
  from public.user_prayer_progress
  where user_id = v_uid
    and prayer_item_id = v_prayer_item_id
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
  returning id into v_op_id;

  perform public.internal_insert_changed_item(v_op_id, v_prayer_item_id, v_before, v_new_count);

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

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

  select completion_count into v_before
  from public.user_prayer_progress
  where user_id = v_uid
    and prayer_item_id = v_prayer_item_id
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
  returning id into v_op_id;
  perform public.internal_insert_changed_item(v_op_id, v_prayer_item_id, v_before, 0);

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

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

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
  returning id into v_op_id;

  insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
  select v_op_id, upp.prayer_item_id, upp.completion_count, v_previous_total
  from public.user_prayer_progress upp
  where upp.user_id = v_uid
    and upp.prayer_item_id in (select e.prayer_item_id from public.internal_eligible_main_prayers(v_uid) e)
    and upp.completion_count > v_previous_total;

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

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

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
  returning id into v_op_id;

  insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
  select v_op_id, upp.prayer_item_id, upp.completion_count, 0
  from public.user_prayer_progress upp
  join public.prayer_items pi on pi.id = upp.prayer_item_id
  where upp.user_id = v_uid
    and pi.category = 'main'
    and pi.is_active = true
    and upp.completion_count > 0;

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

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

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
  returning id into v_op_id;

  insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
  select v_op_id, prayer_item_id, completion_count, 0
  from public.user_prayer_progress
  where user_id = v_uid
    and completion_count > 0;

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

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

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
  returning id into v_op_id;

  insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
  select
    v_op_id,
    pi.id,
    coalesce(upp.completion_count, 0),
    v_new_count
  from public.prayer_items pi
  left join public.user_prayer_progress upp
    on upp.prayer_item_id = pi.id
   and upp.user_id = v_uid
  where pi.category = 'main'
    and pi.is_active = true
    and coalesce(upp.completion_count, 0) is distinct from v_new_count
    and not (v_new_count = 0 and upp.prayer_item_id is null);

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
begin
  v_uid := public.internal_require_user();
  v_tz := public.internal_user_time_zone(v_uid);
  v_date := coalesce(target_date, (timezone(v_tz, now()))::date);

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

create or replace function public.delete_history_operation(p_operation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_operation_id uuid := p_operation_id;
begin
  v_uid := public.internal_require_user();

  delete from public.prayer_progress_operations
  where id = v_operation_id
    and user_id = v_uid
    and operation_type <> 'complete';

  return found;
end;
$$;

create or replace function public.delete_all_history()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_deleted integer;
begin
  v_uid := public.internal_require_user();

  delete from public.prayer_progress_operations
  where user_id = v_uid
    and operation_type <> 'complete';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.purge_prayer_storage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dedup integer := 0;
  v_daily integer := 0;
  v_ops integer := 0;
  v_items integer := 0;
begin
  if auth.uid() is not null then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  delete from public.prayer_command_dedup
  where created_at < now() - interval '14 days';
  get diagnostics v_dedup = row_count;

  delete from public.user_daily_prayer_stats
  where local_date < ((timezone('Asia/Seoul', now()))::date - 90);
  get diagnostics v_daily = row_count;

  delete from public.prayer_progress_operation_items oi
  using public.prayer_progress_operations op
  where oi.operation_id = op.id
    and op.operation_type <> 'complete'
    and op.created_at < now() - interval '180 days';
  get diagnostics v_items = row_count;

  delete from public.prayer_progress_operations
  where operation_type <> 'complete'
    and created_at < now() - interval '180 days';
  get diagnostics v_ops = row_count;

  return jsonb_build_object(
    'deleted_dedup_rows', v_dedup,
    'deleted_daily_rows', v_daily,
    'deleted_audit_operations', v_ops,
    'deleted_audit_items', v_items,
    'deleted_legacy_complete_operations', 0
  );
end;
$$;

create or replace function public.purge_legacy_complete_operations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matched boolean := false;
  v_deleted integer := 0;
begin
  if auth.uid() is not null then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  select matched into v_matched
  from public.prayer_storage_backfill_report
  order by checked_at desc
  limit 1;

  if v_matched is not true then
    raise exception 'BACKFILL_NOT_VERIFIED' using errcode = 'P0001';
  end if;

  delete from public.prayer_progress_operations
  where operation_type = 'complete';
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('deleted_legacy_complete_operations', v_deleted);
end;
$$;

revoke all on function public.internal_eligible_main_prayers(uuid) from public, anon, authenticated;
revoke all on function public.internal_command_result(uuid, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.internal_begin_command(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.internal_finish_command(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.internal_insert_changed_item(uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.purge_prayer_storage() from public, anon, authenticated;
revoke all on function public.purge_legacy_complete_operations() from public, anon, authenticated;

revoke all on function public.complete_prayer(uuid, uuid) from public, anon;
revoke all on function public.set_prayer_count(uuid, integer, uuid) from public, anon;
revoke all on function public.reset_prayer_item(uuid, uuid) from public, anon;
revoke all on function public.reset_current_round(uuid) from public, anon;
revoke all on function public.reset_main_prayers(uuid) from public, anon;
revoke all on function public.reset_all_prayers(uuid) from public, anon;
revoke all on function public.bulk_set_main_prayer_count(integer, uuid) from public, anon;
revoke all on function public.get_daily_prayer_summary(date) from public, anon;
revoke all on function public.delete_history_operation(uuid) from public, anon;
revoke all on function public.delete_all_history() from public, anon;

grant execute on function public.complete_prayer(uuid, uuid) to authenticated;
grant execute on function public.set_prayer_count(uuid, integer, uuid) to authenticated;
grant execute on function public.reset_prayer_item(uuid, uuid) to authenticated;
grant execute on function public.reset_current_round(uuid) to authenticated;
grant execute on function public.reset_main_prayers(uuid) to authenticated;
grant execute on function public.reset_all_prayers(uuid) to authenticated;
grant execute on function public.bulk_set_main_prayer_count(integer, uuid) to authenticated;
grant execute on function public.get_daily_prayer_summary(date) to authenticated;
grant execute on function public.delete_history_operation(uuid) to authenticated;
grant execute on function public.delete_all_history() to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.purge_prayer_storage() to service_role;
    grant execute on function public.purge_legacy_complete_operations() to service_role;
  end if;
end
$$;
