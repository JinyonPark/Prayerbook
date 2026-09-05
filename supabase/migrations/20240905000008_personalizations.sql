-- User-editable names and intercession text for selected prayers.

create table public.user_prayer_personalizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prayer_slug text not null,
  slot_key text not null,
  value text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_prayer_personalizations_slot_chk check (slot_key in ('name', 'intercession')),
  constraint user_prayer_personalizations_value_chk check (char_length(trim(value)) between 1 and 4000)
);

create unique index user_prayer_personalizations_intercession_uidx
  on public.user_prayer_personalizations (user_id, prayer_slug)
  where slot_key = 'intercession';

create unique index user_prayer_personalizations_name_value_uidx
  on public.user_prayer_personalizations (user_id, prayer_slug, value)
  where slot_key = 'name';

create index user_prayer_personalizations_user_slug_idx
  on public.user_prayer_personalizations (user_id, prayer_slug, slot_key, sort_order);

create trigger user_prayer_personalizations_set_updated_at
  before update on public.user_prayer_personalizations
  for each row execute function public.set_updated_at();

alter table public.user_prayer_personalizations enable row level security;

create policy "users can read own personalizations"
  on public.user_prayer_personalizations
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can insert own personalizations"
  on public.user_prayer_personalizations
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can update own personalizations"
  on public.user_prayer_personalizations
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can delete own personalizations"
  on public.user_prayer_personalizations
  for delete
  to authenticated
  using (user_id = auth.uid());
