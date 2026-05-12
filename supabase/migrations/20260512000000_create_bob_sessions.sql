create table if not exists public.bob_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  mode        text not null check (mode in ('situation', 'image', 'conversation')),
  topic       text,
  title       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists bob_sessions_user_id_created_at_idx
  on public.bob_sessions (user_id, created_at desc);

alter table public.bob_sessions enable row level security;

create policy "bob_users_select_own_sessions"
  on public.bob_sessions for select
  using (auth.uid() = user_id);

create policy "bob_users_insert_own_sessions"
  on public.bob_sessions for insert
  with check (auth.uid() = user_id);

create policy "bob_users_update_own_sessions"
  on public.bob_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "bob_users_delete_own_sessions"
  on public.bob_sessions for delete
  using (auth.uid() = user_id);

create or replace function public.tg_bob_sessions_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

create trigger bob_sessions_set_updated_at
  before update on public.bob_sessions
  for each row execute function public.tg_bob_sessions_set_updated_at();
