-- Additive reader preference for 태신자 name display. Does not modify progress or operations.

alter table public.user_preferences
  add column if not exists conceived_show_all_names boolean not null default false;
