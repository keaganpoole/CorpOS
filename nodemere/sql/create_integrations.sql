create extension if not exists pgcrypto;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'user_integrations'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'integrations'
  ) then
    alter table public.user_integrations rename to integrations;
  end if;
end $$;

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  status text not null default 'not_connected',
  selected boolean not null default false,
  connected_email text null,
  scopes jsonb not null default '[]'::jsonb,
  provider_metadata jsonb not null default '{}'::jsonb,
  credentials jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.integrations
  add column if not exists selected boolean not null default false,
  add column if not exists connected_email text null,
  add column if not exists scopes jsonb not null default '[]'::jsonb,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb,
  add column if not exists credentials jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'integrations_provider_check'
  ) then
    alter table public.integrations
      add constraint integrations_provider_check
      check (provider in ('gmail', 'outlook', 'stripe'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'integrations_status_check'
  ) then
    alter table public.integrations
      add constraint integrations_status_check
      check (status in ('not_connected', 'selected', 'connected', 'error', 'disconnected'));
  end if;
end $$;

create unique index if not exists integrations_user_provider_idx
  on public.integrations (user_id, provider);

create index if not exists integrations_user_id_idx
  on public.integrations (user_id);

create or replace function public.set_integrations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_integrations_updated_at on public.integrations;

create trigger trg_integrations_updated_at
before update on public.integrations
for each row
execute function public.set_integrations_updated_at();

alter table public.integrations enable row level security;

drop policy if exists "Users can view their integrations" on public.integrations;
create policy "Users can view their integrations"
on public.integrations
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their integrations" on public.integrations;
create policy "Users can insert their integrations"
on public.integrations
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their integrations" on public.integrations;
create policy "Users can update their integrations"
on public.integrations
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

