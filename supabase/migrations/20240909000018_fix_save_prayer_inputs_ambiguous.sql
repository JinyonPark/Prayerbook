-- Qualify prayer_item_id in save_prayer_inputs. PostgreSQL 17 treats
-- function argument names as conflicting with same-named columns.

create or replace function public.save_prayer_inputs(
  prayer_item_id uuid,
  p_input_values jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
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
    delete from public.user_prayer_inputs inp
    where inp.user_id = v_uid
      and inp.prayer_item_id = v_prayer_item_id;
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

revoke all on function public.save_prayer_inputs(uuid, jsonb) from public, anon;
grant execute on function public.save_prayer_inputs(uuid, jsonb) to authenticated;
