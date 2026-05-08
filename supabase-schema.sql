-- Personal OS Supabase schema
-- Run this in Supabase SQL Editor after creating your Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.user_kv (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_kv enable row level security;

drop policy if exists "Users can read own Personal OS data" on public.user_kv;
create policy "Users can read own Personal OS data"
  on public.user_kv
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own Personal OS data" on public.user_kv;
create policy "Users can insert own Personal OS data"
  on public.user_kv
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own Personal OS data" on public.user_kv;
create policy "Users can update own Personal OS data"
  on public.user_kv
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own Personal OS data" on public.user_kv;
create policy "Users can delete own Personal OS data"
  on public.user_kv
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_user_kv_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_kv_updated_at on public.user_kv;
create trigger set_user_kv_updated_at
  before update on public.user_kv
  for each row
  execute function public.set_user_kv_updated_at();
