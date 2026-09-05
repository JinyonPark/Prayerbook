-- PostgreSQL 17 treats function argument names as conflicting with
-- same-named table columns in INSERT/RETURNING. Copy args into locals.

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
  v_existing jsonb;
  v_item public.prayer_items%rowtype;
  v_before integer;
  v_after integer;
  v_previous_total integer;
  v_op_id uuid;
  v_snapshot jsonb;
  v_prayer_item_id uuid := prayer_item_id;
  v_client_event_id uuid := client_event_id;
begin
  v_uid := public.internal_require_user();
  v_existing := public.internal_existing_operation_result(v_uid, v_client_event_id);
  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_item
  from public.prayer_items
  where id = v_prayer_item_id
    and is_active = true;

  if not found then
    raise exception 'PRAYER_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;
  v_before := public.internal_current_count(v_uid, v_prayer_item_id);

  insert into public.user_prayer_progress (user_id, prayer_item_id, completion_count, updated_at)
  values (v_uid, v_prayer_item_id, 1, now())
  on conflict on constraint user_prayer_progress_pkey
  do update set
    completion_count = public.user_prayer_progress.completion_count + 1,
    updated_at = now()
  returning completion_count into v_after;

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, v_client_event_id, 'complete')
  returning id into v_op_id;

  insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
  values (v_op_id, v_prayer_item_id, v_before, v_after);

  v_snapshot := public.internal_progress_snapshot(v_uid);
  return public.internal_operation_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('idempotent', false);
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
  v_existing jsonb;
  v_item public.prayer_items%rowtype;
  v_before integer;
  v_previous_total integer;
  v_op_id uuid;
  v_snapshot jsonb;
  v_prayer_item_id uuid := prayer_item_id;
  v_client_event_id uuid := client_event_id;
  v_new_count integer := new_count;
begin
  v_uid := public.internal_require_user();
  v_existing := public.internal_existing_operation_result(v_uid, v_client_event_id);
  if v_existing is not null then
    return v_existing;
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
  v_before := public.internal_current_count(v_uid, v_prayer_item_id);

  perform public.internal_upsert_count(v_uid, v_prayer_item_id, v_new_count);

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, v_client_event_id, 'manual_edit')
  returning id into v_op_id;

  insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
  values (v_op_id, v_prayer_item_id, v_before, v_new_count);

  v_snapshot := public.internal_progress_snapshot(v_uid);
  return public.internal_operation_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('idempotent', false);
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
  v_existing jsonb;
  v_item public.prayer_items%rowtype;
  v_before integer;
  v_previous_total integer;
  v_op_id uuid;
  v_snapshot jsonb;
  v_prayer_item_id uuid := prayer_item_id;
  v_client_event_id uuid := client_event_id;
begin
  v_uid := public.internal_require_user();
  v_existing := public.internal_existing_operation_result(v_uid, v_client_event_id);
  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_item
  from public.prayer_items
  where id = v_prayer_item_id
    and is_active = true;

  if not found then
    raise exception 'PRAYER_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;
  v_before := public.internal_current_count(v_uid, v_prayer_item_id);

  perform public.internal_upsert_count(v_uid, v_prayer_item_id, 0);

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, v_client_event_id, 'item_reset')
  returning id into v_op_id;

  insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
  values (v_op_id, v_prayer_item_id, v_before, 0);

  v_snapshot := public.internal_progress_snapshot(v_uid);
  return public.internal_operation_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('idempotent', false);
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
  v_existing jsonb;
  v_previous_total integer;
  v_op_id uuid;
  v_snapshot jsonb;
  v_client_event_id uuid := client_event_id;
begin
  v_uid := public.internal_require_user();
  v_existing := public.internal_existing_operation_result(v_uid, v_client_event_id);
  if v_existing is not null then
    return v_existing;
  end if;

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, v_client_event_id, 'current_round_reset')
  returning id into v_op_id;

  insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
  select
    v_op_id,
    pi.id,
    coalesce(upp.completion_count, 0),
    v_previous_total
  from public.prayer_items pi
  left join public.user_prayer_progress upp
    on upp.prayer_item_id = pi.id
   and upp.user_id = v_uid
  where pi.category = 'main'
    and pi.is_active = true
    and coalesce(upp.completion_count, 0) > v_previous_total;

  update public.user_prayer_progress upp
  set completion_count = v_previous_total,
      updated_at = now()
  from public.prayer_items pi
  where upp.user_id = v_uid
    and upp.prayer_item_id = pi.id
    and pi.category = 'main'
    and upp.completion_count > v_previous_total;

  v_snapshot := public.internal_progress_snapshot(v_uid);
  return public.internal_operation_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('idempotent', false);
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
  v_existing jsonb;
  v_previous_total integer;
  v_op_id uuid;
  v_snapshot jsonb;
  v_client_event_id uuid := client_event_id;
begin
  v_uid := public.internal_require_user();
  v_existing := public.internal_existing_operation_result(v_uid, v_client_event_id);
  if v_existing is not null then
    return v_existing;
  end if;

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, v_client_event_id, 'main_full_reset')
  returning id into v_op_id;

  insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
  select
    v_op_id,
    pi.id,
    coalesce(upp.completion_count, 0),
    0
  from public.prayer_items pi
  left join public.user_prayer_progress upp
    on upp.prayer_item_id = pi.id
   and upp.user_id = v_uid
  where pi.category = 'main'
    and pi.is_active = true;

  insert into public.user_prayer_progress (user_id, prayer_item_id, completion_count, updated_at)
  select v_uid, pi.id, 0, now()
  from public.prayer_items pi
  where pi.category = 'main'
    and pi.is_active = true
  on conflict on constraint user_prayer_progress_pkey
  do update set
    completion_count = 0,
    updated_at = now();

  v_snapshot := public.internal_progress_snapshot(v_uid);
  return public.internal_operation_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('idempotent', false);
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
  v_existing jsonb;
  v_previous_total integer;
  v_op_id uuid;
  v_snapshot jsonb;
  v_client_event_id uuid := client_event_id;
begin
  v_uid := public.internal_require_user();
  v_existing := public.internal_existing_operation_result(v_uid, v_client_event_id);
  if v_existing is not null then
    return v_existing;
  end if;

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, v_client_event_id, 'all_full_reset')
  returning id into v_op_id;

  insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
  select
    v_op_id,
    pi.id,
    coalesce(upp.completion_count, 0),
    0
  from public.prayer_items pi
  left join public.user_prayer_progress upp
    on upp.prayer_item_id = pi.id
   and upp.user_id = v_uid
  where pi.is_active = true;

  insert into public.user_prayer_progress (user_id, prayer_item_id, completion_count, updated_at)
  select v_uid, pi.id, 0, now()
  from public.prayer_items pi
  where pi.is_active = true
  on conflict on constraint user_prayer_progress_pkey
  do update set
    completion_count = 0,
    updated_at = now();

  v_snapshot := public.internal_progress_snapshot(v_uid);
  return public.internal_operation_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('idempotent', false);
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
  v_existing jsonb;
  v_previous_total integer;
  v_op_id uuid;
  v_snapshot jsonb;
  v_client_event_id uuid := client_event_id;
  v_new_count integer := new_count;
begin
  v_uid := public.internal_require_user();
  v_existing := public.internal_existing_operation_result(v_uid, v_client_event_id);
  if v_existing is not null then
    return v_existing;
  end if;

  if v_new_count is null or v_new_count < 0 or v_new_count > 10000 or v_new_count <> trunc(v_new_count) then
    raise exception 'INVALID_COUNT' using errcode = '22023';
  end if;

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

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
    and pi.is_active = true;

  insert into public.user_prayer_progress (user_id, prayer_item_id, completion_count, updated_at)
  select v_uid, pi.id, v_new_count, now()
  from public.prayer_items pi
  where pi.category = 'main'
    and pi.is_active = true
  on conflict on constraint user_prayer_progress_pkey
  do update set
    completion_count = excluded.completion_count,
    updated_at = now();

  v_snapshot := public.internal_progress_snapshot(v_uid);
  return public.internal_operation_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('idempotent', false);
end;
$$;

revoke all on function public.complete_prayer(uuid, uuid) from public, anon;
revoke all on function public.set_prayer_count(uuid, integer, uuid) from public, anon;
revoke all on function public.reset_prayer_item(uuid, uuid) from public, anon;
revoke all on function public.reset_current_round(uuid) from public, anon;
revoke all on function public.reset_main_prayers(uuid) from public, anon;
revoke all on function public.reset_all_prayers(uuid) from public, anon;
revoke all on function public.bulk_set_main_prayer_count(integer, uuid) from public, anon;

grant execute on function public.complete_prayer(uuid, uuid) to authenticated;
grant execute on function public.set_prayer_count(uuid, integer, uuid) to authenticated;
grant execute on function public.reset_prayer_item(uuid, uuid) to authenticated;
grant execute on function public.reset_current_round(uuid) to authenticated;
grant execute on function public.reset_main_prayers(uuid) to authenticated;
grant execute on function public.reset_all_prayers(uuid) to authenticated;
grant execute on function public.bulk_set_main_prayer_count(integer, uuid) to authenticated;
