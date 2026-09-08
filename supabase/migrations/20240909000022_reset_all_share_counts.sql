-- Full reset also clears today/lifetime share counts.
-- Does not delete complete-operation history, auth.users, or reading state.

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

  v_lifetime := coalesce((
    select t.lifetime_completion_count
    from public.user_prayer_totals t
    where t.user_id = v_uid
  ), 0);

  if v_changed = 0 and v_daily_rows = 0 and v_lifetime = 0 then
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

revoke all on function public.reset_all_prayers(uuid) from public, anon;
grant execute on function public.reset_all_prayers(uuid) to authenticated;
