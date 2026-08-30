-- Dashboard issue reports submitted by authenticated business users.

begin;

create table if not exists public.bugs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id bigint not null references public.businesses(id) on delete cascade,
  description text not null,
  severity smallint not null default 3,
  page text null,
  user_agent text null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bugs_description_length check (char_length(trim(description)) between 1 and 10000),
  constraint bugs_severity_check check (severity between 1 and 5),
  constraint bugs_status_check check (status in ('open', 'in_progress', 'resolved', 'closed'))
);

create index if not exists bugs_user_created_at_idx
  on public.bugs (user_id, created_at desc);

create index if not exists bugs_business_created_at_idx
  on public.bugs (business_id, created_at desc);

alter table public.bugs enable row level security;

drop policy if exists "users can create own bug reports" on public.bugs;
create policy "users can create own bug reports" on public.bugs
for insert with check (auth.uid() = user_id);

drop policy if exists "users can read own bug reports" on public.bugs;
create policy "users can read own bug reports" on public.bugs
for select using (auth.uid() = user_id);

commit;
