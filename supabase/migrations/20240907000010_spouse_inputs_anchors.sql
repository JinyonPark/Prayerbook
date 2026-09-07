-- Additive reader, personalization, and spouse-progress updates.
-- Does not modify user_prayer_progress completion counts or auth.users.

alter table public.user_preferences
  add column if not exists spouse_prayer_selection text null,
  add column if not exists auto_scroll_speed text not null default 'normal';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_preferences_spouse_chk'
  ) then
    alter table public.user_preferences
      add constraint user_preferences_spouse_chk
      check (spouse_prayer_selection is null or spouse_prayer_selection in ('husband', 'wife'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'user_preferences_auto_scroll_chk'
  ) then
    alter table public.user_preferences
      add constraint user_preferences_auto_scroll_chk
      check (auto_scroll_speed in ('slow', 'normal', 'fast'));
  end if;
end
$$;

alter table public.user_reading_state
  add column if not exists anchor_key text null,
  add column if not exists anchor_offset double precision null;

create table if not exists public.user_prayer_inputs (
  user_id uuid not null references auth.users(id) on delete cascade,
  prayer_item_id uuid not null references public.prayer_items(id) on delete cascade,
  values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, prayer_item_id)
);

drop trigger if exists user_prayer_inputs_set_updated_at on public.user_prayer_inputs;
create trigger user_prayer_inputs_set_updated_at
  before update on public.user_prayer_inputs
  for each row execute function public.set_updated_at();

alter table public.user_prayer_inputs enable row level security;

drop policy if exists "users can read own prayer inputs" on public.user_prayer_inputs;
create policy "users can read own prayer inputs"
  on public.user_prayer_inputs
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "users can insert own prayer inputs" on public.user_prayer_inputs;
create policy "users can insert own prayer inputs"
  on public.user_prayer_inputs
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users can update own prayer inputs" on public.user_prayer_inputs;
create policy "users can update own prayer inputs"
  on public.user_prayer_inputs
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users can delete own prayer inputs" on public.user_prayer_inputs;
create policy "users can delete own prayer inputs"
  on public.user_prayer_inputs
  for delete
  to authenticated
  using (user_id = auth.uid());

insert into public.user_prayer_inputs (user_id, prayer_item_id, values)
select
  p.user_id,
  i.id,
  jsonb_build_object('child_names', jsonb_agg(p.value order by p.sort_order, p.created_at))
from public.user_prayer_personalizations p
join public.prayer_items i on i.slug = 'children'
where p.prayer_slug = 'children'
  and p.slot_key = 'name'
group by p.user_id, i.id
on conflict (user_id, prayer_item_id) do update
set values = public.user_prayer_inputs.values || excluded.values,
    updated_at = now();

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
  from public.prayer_items pi
  left join public.user_prayer_progress upp
    on upp.prayer_item_id = pi.id
   and upp.user_id = p_user_id
  where pi.category = 'main'
    and pi.is_active = true
    and pi.counts_toward_total = true
    and (
      v_spouse is null
      or (v_spouse = 'husband' and pi.item_number is distinct from 10)
      or (v_spouse = 'wife' and pi.item_number is distinct from 9)
    );

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
    and coalesce(upp.completion_count, 0) >= v_round
    and (
      v_spouse is null
      or (v_spouse = 'husband' and pi.item_number is distinct from 10)
      or (v_spouse = 'wife' and pi.item_number is distinct from 9)
    );

  select count(*)::integer
    into v_main_n
  from public.prayer_items pi
  where pi.category = 'main'
    and pi.is_active = true
    and pi.counts_toward_total = true
    and (
      v_spouse is null
      or (v_spouse = 'husband' and pi.item_number is distinct from 10)
      or (v_spouse = 'wife' and pi.item_number is distinct from 9)
    );

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
