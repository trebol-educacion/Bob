create table if not exists public.bob_exercise_pool (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists bob_exercise_pool_mode_idx
  on public.bob_exercise_pool (mode, created_at);

alter table public.bob_exercise_pool enable row level security;

create or replace function public.claim_bob_exercise(p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  delete from public.bob_exercise_pool
  where id = (
    select id from public.bob_exercise_pool
    where mode = p_mode
    order by created_at
    for update skip locked
    limit 1
  )
  returning payload into v_payload;
  return v_payload;
end;
$$;

create or replace function public.add_bob_exercises(p_mode text, p_payloads jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.bob_exercise_pool (mode, payload)
  select p_mode, value from jsonb_array_elements(p_payloads);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.count_bob_exercises(p_mode text)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.bob_exercise_pool where mode = p_mode;
$$;

grant execute on function public.claim_bob_exercise(text) to authenticated;
grant execute on function public.add_bob_exercises(text, jsonb) to authenticated, service_role;
grant execute on function public.count_bob_exercises(text) to authenticated, service_role;
