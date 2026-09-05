-- Allow a user to delete their own history log without changing completion counts.

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
    and user_id = v_uid;

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
  where user_id = v_uid;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.delete_history_operation(uuid) from public, anon;
revoke all on function public.delete_all_history() from public, anon;
grant execute on function public.delete_history_operation(uuid) to authenticated;
grant execute on function public.delete_all_history() to authenticated;
