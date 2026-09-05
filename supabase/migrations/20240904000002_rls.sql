-- Row Level Security policies.

alter table public.profiles enable row level security;
alter table public.prayer_items enable row level security;
alter table public.user_prayer_progress enable row level security;
alter table public.user_reading_state enable row level security;
alter table public.user_preferences enable row level security;
alter table public.prayer_progress_operations enable row level security;
alter table public.prayer_progress_operation_items enable row level security;

create policy "authenticated users can read active prayers"
  on public.prayer_items
  for select
  to authenticated
  using (is_active = true);

create policy "users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users can read own progress"
  on public.user_prayer_progress
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can read own reading state"
  on public.user_reading_state
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can insert own reading state"
  on public.user_reading_state
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can update own reading state"
  on public.user_reading_state
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can read own preferences"
  on public.user_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can insert own preferences"
  on public.user_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can update own preferences"
  on public.user_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can read own operations"
  on public.prayer_progress_operations
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can read own operation items"
  on public.prayer_progress_operation_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.prayer_progress_operations op
      where op.id = prayer_progress_operation_items.operation_id
        and op.user_id = auth.uid()
    )
  );

revoke insert, update, delete on public.prayer_items from authenticated, anon;
revoke insert, update, delete on public.user_prayer_progress from authenticated, anon;
revoke insert, update, delete on public.prayer_progress_operations from authenticated, anon;
revoke insert, update, delete on public.prayer_progress_operation_items from authenticated, anon;
revoke all on public.prayer_items from anon;
revoke all on public.user_prayer_progress from anon;
revoke all on public.prayer_progress_operations from anon;
revoke all on public.prayer_progress_operation_items from anon;
revoke all on public.profiles from anon;
revoke all on public.user_reading_state from anon;
revoke all on public.user_preferences from anon;
