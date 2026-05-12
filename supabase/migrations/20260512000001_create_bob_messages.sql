create table if not exists public.bob_messages (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.bob_sessions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('bob', 'user')),
  msg_type     text not null check (msg_type in ('text', 'phrase', 'image_scene', 'evaluation', 'user_audio')),
  content_text text,
  content_json jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists bob_messages_session_id_idx
  on public.bob_messages (session_id, created_at asc);

alter table public.bob_messages enable row level security;

create policy "bob_users_select_own_messages"
  on public.bob_messages for select using (auth.uid() = user_id);

create policy "bob_users_insert_own_messages"
  on public.bob_messages for insert with check (auth.uid() = user_id);

create policy "bob_users_delete_own_messages"
  on public.bob_messages for delete using (auth.uid() = user_id);
