-- Username login ids mapped to auto-confirmed auth users.

create table public.user_login_ids (
  login_id text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  auth_email text not null unique,
  created_at timestamptz not null default now(),
  constraint user_login_ids_login_chk check (
    char_length(login_id) between 3 and 20
    and login_id ~ '^[a-z0-9][a-z0-9._-]*$'
  )
);

alter table public.user_login_ids enable row level security;

create policy "users can read own login id"
  on public.user_login_ids
  for select
  to authenticated
  using (user_id = auth.uid());
