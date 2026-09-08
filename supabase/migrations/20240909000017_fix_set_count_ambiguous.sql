-- Qualify prayer_item_id in set/reset RPCs. PostgreSQL 17 treats
-- function argument names as conflicting with same-named columns.

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

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

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

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;

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
  returning id into v_op_id;
  perform public.internal_insert_changed_item(v_op_id, v_prayer_item_id, v_before, 0);

  v_snapshot := public.internal_progress_snapshot(v_uid);
  v_result := public.internal_command_result(v_op_id, v_previous_total, v_snapshot)
    || jsonb_build_object('request_id', v_client_event_id);
  return public.internal_finish_command(v_uid, v_client_event_id, v_result);
end;
$$;

revoke all on function public.set_prayer_count(uuid, integer, uuid) from public, anon;
revoke all on function public.reset_prayer_item(uuid, uuid) from public, anon;
grant execute on function public.set_prayer_count(uuid, integer, uuid) to authenticated;
grant execute on function public.reset_prayer_item(uuid, uuid) to authenticated;
