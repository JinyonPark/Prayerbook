-- Prayer input RPC, login_id normalization, and legacy personalization comments.
-- Does not drop user_prayer_personalizations or change auth.users ids.

comment on table public.user_prayer_personalizations is
  'Legacy personalization rows. New writes go to user_prayer_inputs via save_prayer_inputs(). Do not use as the source of truth.';

insert into public.user_prayer_inputs (user_id, prayer_item_id, values)
select
  p.user_id,
  i.id,
  jsonb_strip_nulls(jsonb_build_object(
    'names', case when i.slug <> 'children' then to_jsonb(array_agg(p.value order by p.sort_order, p.created_at)) end,
    'child_names', case when i.slug = 'children' then to_jsonb(array_agg(p.value order by p.sort_order, p.created_at)) end
  ))
from public.user_prayer_personalizations p
join public.prayer_items i on i.slug = p.prayer_slug
where p.slot_key = 'name'
group by p.user_id, i.id, i.slug
on conflict (user_id, prayer_item_id) do update
set values = public.user_prayer_inputs.values || excluded.values,
    updated_at = now();

insert into public.user_prayer_inputs (user_id, prayer_item_id, values)
select
  p.user_id,
  i.id,
  jsonb_build_object('intercession', (array_agg(p.value order by p.sort_order, p.updated_at desc))[1])
from public.user_prayer_personalizations p
join public.prayer_items i on i.slug = p.prayer_slug
where p.slot_key = 'intercession'
  and char_length(trim(p.value)) > 0
group by p.user_id, i.id
on conflict (user_id, prayer_item_id) do update
set values = public.user_prayer_inputs.values || excluded.values,
    updated_at = now();

create or replace function public.internal_normalize_prayer_input_values(p_values jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_key text;
  v_out jsonb := '{}'::jsonb;
  v_names jsonb;
  v_text text;
  v_allowed text[] := array[
    'child_names',
    'names',
    'intercession',
    'disease_target_name',
    'disease_name',
    'wish_text',
    'forgiveness_person_name',
    'evangelism_target_name'
  ];
  v_limits jsonb := jsonb_build_object(
    'disease_target_name', 100,
    'disease_name', 200,
    'wish_text', 1000,
    'forgiveness_person_name', 100,
    'evangelism_target_name', 100,
    'intercession', 4000
  );
begin
  if p_values is null or p_values = 'null'::jsonb then
    return '{}'::jsonb;
  end if;
  if jsonb_typeof(p_values) <> 'object' then
    raise exception 'INVALID_INPUT_VALUES' using errcode = '22023';
  end if;
  if pg_column_size(p_values) > 16384 then
    raise exception 'INPUT_TOO_LARGE' using errcode = '22023';
  end if;

  for v_key in select jsonb_object_keys(p_values)
  loop
    if not (v_key = any (v_allowed)) then
      raise exception 'INVALID_INPUT_KEY' using errcode = '22023';
    end if;
  end loop;

  if p_values ? 'child_names' or p_values ? 'names' then
    v_names := coalesce(p_values->'child_names', p_values->'names');
    if v_names is not null and v_names <> 'null'::jsonb then
      if jsonb_typeof(v_names) <> 'array' then
        raise exception 'INVALID_INPUT_VALUES' using errcode = '22023';
      end if;
      if jsonb_array_length(v_names) > 20 then
        raise exception 'TOO_MANY_NAMES' using errcode = '22023';
      end if;
      select coalesce(jsonb_agg(to_jsonb(named.trimmed) order by named.ord), '[]'::jsonb)
        into v_names
      from (
        select trimmed, min(ord) as ord
        from (
          select
            left(trim(both from regexp_replace(value #>> '{}', '[<>]', '', 'g')), 50) as trimmed,
            ordinality as ord
          from jsonb_array_elements(v_names) with ordinality
        ) raw
        where trimmed <> ''
        group by trimmed
      ) named;
      if p_values ? 'child_names' then
        v_out := v_out || jsonb_build_object('child_names', v_names);
      else
        v_out := v_out || jsonb_build_object('names', v_names);
      end if;
    end if;
  end if;

  foreach v_key in array array[
    'intercession',
    'disease_target_name',
    'disease_name',
    'wish_text',
    'forgiveness_person_name',
    'evangelism_target_name'
  ]
  loop
    if p_values ? v_key then
      if jsonb_typeof(p_values->v_key) <> 'string' then
        raise exception 'INVALID_INPUT_VALUES' using errcode = '22023';
      end if;
      v_text := left(
        trim(both from regexp_replace(p_values->>v_key, '[<>]', '', 'g')),
        (v_limits->>v_key)::integer
      );
      if v_text <> '' then
        v_out := v_out || jsonb_build_object(v_key, v_text);
      end if;
    end if;
  end loop;

  return v_out;
end;
$$;

create or replace function public.save_prayer_inputs(
  prayer_item_id uuid,
  p_input_values jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_prayer_item_id uuid := prayer_item_id;
  v_item public.prayer_items%rowtype;
  v_values jsonb;
begin
  v_uid := public.internal_require_user();

  select * into v_item
  from public.prayer_items
  where id = v_prayer_item_id
    and is_active = true;
  if not found then
    raise exception 'PRAYER_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_values := public.internal_normalize_prayer_input_values(p_input_values);

  if v_values = '{}'::jsonb then
    delete from public.user_prayer_inputs
    where user_id = v_uid
      and prayer_item_id = v_prayer_item_id;
    return jsonb_build_object('prayer_item_id', v_prayer_item_id, 'values', '{}'::jsonb);
  end if;

  insert into public.user_prayer_inputs (user_id, prayer_item_id, values)
  values (v_uid, v_prayer_item_id, v_values)
  on conflict (user_id, prayer_item_id)
  do update set
    values = excluded.values,
    updated_at = now();

  return jsonb_build_object('prayer_item_id', v_prayer_item_id, 'values', v_values);
end;
$$;

drop policy if exists "users can insert own prayer inputs" on public.user_prayer_inputs;
drop policy if exists "users can update own prayer inputs" on public.user_prayer_inputs;
drop policy if exists "users can delete own prayer inputs" on public.user_prayer_inputs;
revoke insert, update, delete on public.user_prayer_inputs from authenticated, anon, public;
grant select on public.user_prayer_inputs to authenticated;

drop policy if exists "users can insert own personalizations" on public.user_prayer_personalizations;
drop policy if exists "users can update own personalizations" on public.user_prayer_personalizations;
drop policy if exists "users can delete own personalizations" on public.user_prayer_personalizations;
revoke insert, update, delete on public.user_prayer_personalizations from authenticated, anon, public;

revoke all on function public.internal_normalize_prayer_input_values(jsonb) from public, anon, authenticated;
revoke all on function public.save_prayer_inputs(uuid, jsonb) from public, anon;
grant execute on function public.save_prayer_inputs(uuid, jsonb) to authenticated;

alter table public.user_login_ids
  add column if not exists normalized_login_id text;

update public.user_login_ids
set normalized_login_id = lower(normalize(login_id, nfkc))
where normalized_login_id is null;

alter table public.user_login_ids
  alter column normalized_login_id set not null;

create unique index if not exists user_login_ids_normalized_uidx
  on public.user_login_ids (normalized_login_id);

alter table public.user_login_ids
  drop constraint if exists user_login_ids_login_chk;

alter table public.user_login_ids
  add constraint user_login_ids_login_chk check (
    char_length(login_id) between 3 and 30
    and login_id !~ '\s'
  );

alter table public.user_login_ids
  drop constraint if exists user_login_ids_normalized_chk;

alter table public.user_login_ids
  add constraint user_login_ids_normalized_chk check (
    char_length(normalized_login_id) between 3 and 30
    and normalized_login_id = lower(normalize(normalized_login_id, nfkc))
    and normalized_login_id ~ '^[0-9a-z._-]*$|^[0-9a-z._가-힣-]*$'
  );
