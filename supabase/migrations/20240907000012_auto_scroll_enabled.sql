-- Additive auto-scroll preference. Does not modify progress or operations.

alter table public.user_preferences
  add column if not exists auto_scroll_enabled boolean not null default false;
