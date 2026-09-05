-- Progress RPCs. All functions use auth.uid() and never accept user_id.

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
  v_items jsonb;
begin
  select coalesce(min(coalesce(upp.completion_count, 0)), 0)
    into v_total
  from public.prayer_items pi
  left join public.user_prayer_progress upp
    on upp.prayer_item_id = pi.id
   and upp.user_id = p_user_id
  where pi.category = 'main'
    and pi.is_active = true
    and pi.counts_toward_total = true;

  v_round := v_total + 1;

  select count(*)::integer
    into v_completed
  from public.prayer_items pi
  left join public.user_prayer_progress upp
    on upp.prayer_item_id = pi.id
   and upp.user_id = p_user_id
  where pi.category = 'main'
    and pi.is_active = true
    and pi.counts_toward_total = true
    and coalesce(upp.completion_count, 0) >= v_round;

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
      'is_completed_in_current_round',
        case
          when pi.category = 'main' then coalesce(upp.completion_count, 0) >= v_round
          else null
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
    'progress_percent', (v_completed::numeric / 25) * 100,
    'items', v_items
  );
end;
$$;

create or replace function public.internal_operation_result(
  p_operation_id uuid,
  p_previous_total integer,
  p_snapshot jsonb
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'prayer_item_id', oi.prayer_item_id,
    'before_count', oi.before_count,
    'after_count', oi.after_count
  )), '[]'::jsonb)
    into v_items
  from public.prayer_progress_operation_items oi
  where oi.operation_id = p_operation_id;

  return p_snapshot || jsonb_build_object(
    'operation_id', p_operation_id,
    'affected_items', v_items,
    'total_changed', v_current <> p_previous_total,
    'previous_total', p_previous_total,
    'current_total', v_current
  );
end;
$$;

create or replace function public.internal_existing_operation_result(
  p_user_id uuid,
  p_client_event_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_op public.prayer_progress_operations%rowtype;
  v_snapshot jsonb;
begin
  select *
    into v_op
  from public.prayer_progress_operations
  where user_id = p_user_id
    and client_event_id = p_client_event_id;

  if not found then
    return null;
  end if;

  v_snapshot := public.internal_progress_snapshot(p_user_id);
  return public.internal_operation_result(
    v_op.id,
    (v_snapshot->>'total_completed')::integer,
    v_snapshot
  ) || jsonb_build_object('idempotent', true, 'total_changed', false);
end;
$$;

create or replace function public.internal_require_user()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

create or replace function public.internal_current_count(p_user_id uuid, p_prayer_item_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select completion_count
    from public.user_prayer_progress
    where user_id = p_user_id
      and prayer_item_id = p_prayer_item_id
  ), 0);
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

  insert into public.user_prayer_progress (user_id, prayer_item_id, completion_count, updated_at)
  values (p_user_id, p_prayer_item_id, p_new_count, now())
  on conflict (user_id, prayer_item_id)
  do update set
    completion_count = excluded.completion_count,
    updated_at = now();
end;
$$;

create or replace function public.get_prayer_progress_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.internal_progress_snapshot(public.internal_require_user());
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
  v_existing jsonb;
  v_item public.prayer_items%rowtype;
  v_before integer;
  v_after integer;
  v_previous_total integer;
  v_op_id uuid;
  v_snapshot jsonb;
begin
  v_uid := public.internal_require_user();
  v_existing := public.internal_existing_operation_result(v_uid, client_event_id);
  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_item
  from public.prayer_items
  where id = prayer_item_id
    and is_active = true;

  if not found then
    raise exception 'PRAYER_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;
  v_before := public.internal_current_count(v_uid, prayer_item_id);

  insert into public.user_prayer_progress (user_id, prayer_item_id, completion_count, updated_at)
  values (v_uid, prayer_item_id, 1, now())
  on conflict (user_id, prayer_item_id)
  do update set
    completion_count = public.user_prayer_progress.completion_count + 1,
    updated_at = now()
  returning completion_count into v_after;

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, client_event_id, 'complete')
  returning id into v_op_id;

  insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
  values (v_op_id, prayer_item_id, v_before, v_after);

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
begin
  v_uid := public.internal_require_user();
  v_existing := public.internal_existing_operation_result(v_uid, client_event_id);
  if v_existing is not null then
    return v_existing;
  end if;

  if new_count is null or new_count < 0 or new_count > 10000 or new_count <> trunc(new_count) then
    raise exception 'INVALID_COUNT' using errcode = '22023';
  end if;

  select * into v_item
  from public.prayer_items
  where id = prayer_item_id
    and is_active = true;

  if not found then
    raise exception 'PRAYER_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_previous_total := (public.internal_progress_snapshot(v_uid)->>'total_completed')::integer;
  v_before := public.internal_current_count(v_uid, prayer_item_id);

  perform public.internal_upsert_count(v_uid, prayer_item_id, new_count);

  insert into public.prayer_progress_operations (user_id, client_event_id, operation_type)
  values (v_uid, client_event_id, 'manual_edit')
  returning id into v_op_id;

  insert into public.prayer_progress_operation_items (operation_id, prayer_item_id, before_count, after_count)
  values (v_op_id, prayer_item_id, v_before, new_count);

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
begin
  return public.set_prayer_count(prayer_item_id, 0, client_event_id)
    || jsonb_build_object('forced_operation_type', 'item_reset');
end;
$$;
