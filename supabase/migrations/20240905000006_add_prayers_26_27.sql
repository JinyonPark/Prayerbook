-- Allow main prayers 1-27 and compute progress against the live main-item count.

alter table public.prayer_items drop constraint if exists prayer_items_main_rules_chk;

alter table public.prayer_items add constraint prayer_items_main_rules_chk check (
  (
    category = 'main'
    and item_number between 1 and 27
    and counts_toward_total = true
  )
  or (
    category = 'supplementary'
    and item_number is null
    and counts_toward_total = false
  )
);

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

  select count(*)::integer
    into v_main_n
  from public.prayer_items pi
  where pi.category = 'main'
    and pi.is_active = true
    and pi.counts_toward_total = true;

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
    'progress_percent', case when v_main_n = 0 then 0 else (v_completed::numeric / v_main_n) * 100 end,
    'items', v_items
  );
end;
$$;
