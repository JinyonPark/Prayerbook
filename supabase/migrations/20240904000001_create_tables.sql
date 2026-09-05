-- Prayer Book schema: tables, constraints, indexes, and auth bootstrap.

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prayer_items (
  id uuid primary key,
  item_number smallint null,
  slug text not null unique,
  title text not null,
  content_md text not null,
  category text not null,
  counts_toward_total boolean not null,
  display_order integer not null,
  source_url text null,
  content_version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prayer_items_category_chk check (category in ('main', 'supplementary')),
  constraint prayer_items_main_rules_chk check (
    (
      category = 'main'
      and item_number between 1 and 25
      and counts_toward_total = true
    )
    or (
      category = 'supplementary'
      and item_number is null
      and counts_toward_total = false
    )
  )
);

create unique index prayer_items_main_item_number_uidx
  on public.prayer_items (item_number)
  where category = 'main';

create index prayer_items_display_order_idx
  on public.prayer_items (display_order);

create table public.user_prayer_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  prayer_item_id uuid not null references public.prayer_items(id) on delete cascade,
  completion_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, prayer_item_id),
  constraint user_prayer_progress_count_chk check (completion_count >= 0)
);

create table public.user_reading_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_prayer_item_id uuid null references public.prayer_items(id),
  scroll_ratio double precision not null default 0,
  last_opened_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint user_reading_state_ratio_chk check (scroll_ratio >= 0 and scroll_ratio <= 1)
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'day',
  font_size text not null default 'default',
  line_height text not null default 'comfortable',
  updated_at timestamptz not null default now(),
  constraint user_preferences_theme_chk check (theme in ('day', 'night')),
  constraint user_preferences_font_size_chk check (font_size in ('small', 'default', 'large', 'xlarge')),
  constraint user_preferences_line_height_chk check (line_height in ('compact', 'comfortable', 'spacious'))
);

create table public.prayer_progress_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_event_id uuid not null,
  operation_type text not null,
  created_at timestamptz not null default now(),
  constraint prayer_progress_operations_type_chk check (
    operation_type in (
      'complete',
      'manual_edit',
      'item_reset',
      'current_round_reset',
      'main_full_reset',
      'all_full_reset',
      'bulk_set'
    )
  ),
  unique (user_id, client_event_id)
);

create index prayer_progress_operations_user_created_idx
  on public.prayer_progress_operations (user_id, created_at desc);

create table public.prayer_progress_operation_items (
  operation_id uuid not null references public.prayer_progress_operations(id) on delete cascade,
  prayer_item_id uuid not null references public.prayer_items(id) on delete cascade,
  before_count integer not null,
  after_count integer not null,
  primary key (operation_id, prayer_item_id),
  constraint prayer_progress_operation_items_before_chk check (before_count >= 0),
  constraint prayer_progress_operation_items_after_chk check (after_count >= 0)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger prayer_items_set_updated_at
  before update on public.prayer_items
  for each row execute function public.set_updated_at();

create trigger user_prayer_progress_set_updated_at
  before update on public.user_prayer_progress
  for each row execute function public.set_updated_at();

create trigger user_reading_state_set_updated_at
  before update on public.user_reading_state
  for each row execute function public.set_updated_at();

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.user_reading_state (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
