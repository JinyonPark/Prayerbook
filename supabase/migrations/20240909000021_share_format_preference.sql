-- Saved copy/share format. Does not modify progress, operations, or auth.users.

alter table public.user_preferences
  add column if not exists share_selected_fields jsonb not null default '{"today":true,"lifetime":true,"total":true,"progress":true}'::jsonb;

alter table public.user_preferences
  add column if not exists share_custom_template text;

alter table public.user_preferences
  drop constraint if exists user_preferences_share_template_len_chk;

alter table public.user_preferences
  add constraint user_preferences_share_template_len_chk
  check (share_custom_template is null or char_length(share_custom_template) <= 2000);
