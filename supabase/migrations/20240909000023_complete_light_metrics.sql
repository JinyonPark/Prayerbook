-- Lightweight complete_prayer: no full items snapshot, no complete audit rows.
-- Does not change user_prayer_progress except via complete_prayer +1.
-- Does not delete history, auth.users, or daily/lifetime tables.

create or replace function public.internal_total_completed(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(min(coalesce(upp.completion_count, 0)), 0)::integer
  from public.internal_eligible_main_prayers(p_user_id) e
  left join public.user_prayer_progress upp
    on upp.prayer_item_id = e.prayer_item_id
   and upp.user_id = p_user_id;
$$;

create or replace function public.internal_progress_metrics(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select coalesce(upp.completion_count, 0) as completion_count
    from public.internal_eligible_main_prayers(p_user_id) e
    left join public.user_prayer_progress upp
      on upp.prayer_item_id = e.prayer_item_id
     and upp.user_id = p_user_id
  ),
  base as (
    select
      coalesce(min(completion_count), 0)::integer as total_completed,
      count(*)::integer as eligible_count
    from eligible
  )
  select jsonb_build_object(
    'total_completed', b.total_completed,
    'current_round', (b.total_completed + 1)::integer,
    'current_completed_count', (
      select count(*)::integer
      from eligible e
      where e.completion_count >= b.total_completed + 1
    ),
    'eligible_count', b.eligible_count,
    'progress_percent', case
      when b.eligible_count = 0 then 0
      else (
        (
          select count(*)::numeric
          from eligible e
          where e.completion_count >= b.total_completed + 1
        ) / b.eligible_count
      ) * 100
    end,
    'spouse_prayer_selection', to_jsonb((
      select pref.spouse_prayer_selection
      from public.user_preferences pref
      where pref.user_id = p_user_id
    ))
  )
  from base b;
$$;

create or replace function public.internal_progress_snapshot(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_metrics jsonb;
  v_items jsonb;
  v_round integer;
  v_spouse text;
begin
  v_metrics := public.internal_progress_metrics(p_user_id);
  v_round := coalesce((v_metrics->>'current_round')::integer, 1);
  if v_metrics->'spouse_prayer_selection' is null or v_metrics->'spouse_prayer_selection' = 'null'::jsonb then
    v_spouse := null;
  else
    v_spouse := v_metrics->>'spouse_prayer_selection';
  end if;

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

  return v_metrics || jsonb_build_object('items', v_items);
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

  v_before := v_after - 1;
  perform public.internal_apply_daily_complete(v_uid, v_prayer_item_id, now());
  perform public.internal_apply_lifetime_complete(v_uid, now());

  v_metrics := public.internal_progress_metrics(v_uid);
  v_tz := public.internal_user_time_zone(v_uid);
  v_date := (timezone(v_tz, now()))::date;

  select
    coalesce(s.total_completion_count, 0),
    coalesce((select count(*)::integer from jsonb_each(s.item_counts)), 0)
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
    'progress', public.internal_progress_snapshot(v_uid),
    'daily', public.get_daily_prayer_summary(null)
  );
end;
$$;

revoke all on function public.internal_total_completed(uuid) from public, anon, authenticated;
revoke all on function public.internal_progress_metrics(uuid) from public, anon, authenticated;
revoke all on function public.complete_prayer(uuid, uuid) from public, anon;
revoke all on function public.get_home_dashboard_summary() from public, anon;
grant execute on function public.complete_prayer(uuid, uuid) to authenticated;
grant execute on function public.get_home_dashboard_summary() to authenticated;

notify pgrst, 'reload schema';
