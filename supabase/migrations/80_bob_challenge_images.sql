drop table if exists public.bob_challenge_images cascade;

create table public.bob_challenge_images (
  id         uuid        primary key default gen_random_uuid(),
  slot_key   text        not null,
  version    int         not null,
  image_url  text        not null,
  created_at timestamptz not null default now(),
  unique (slot_key, version)
);

alter table public.bob_challenge_images enable row level security;

create policy "challenge_images_select"
  on public.bob_challenge_images
  for select
  to authenticated
  using (true);
