-- Normalized server-side events for the Nest dashboard activity surface.
-- Existing source tables remain authoritative; this table is for server-only
-- workflow signals that do not have a safe browser-readable realtime source.

create extension if not exists pgcrypto;

create table if not exists public.nest_events (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('calls', 'appointments', 'people', 'payments', 'workflows', 'warnings', 'milestones', 'messages')),
  event_type text not null,
  priority text not null default 'routine' check (priority in ('routine', 'major', 'critical')),
  title text not null,
  message text not null default '',
  source_id text,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create index if not exists idx_nest_events_business_occurred
  on public.nest_events (business_id, occurred_at desc);

alter table public.nest_events enable row level security;

drop policy if exists "Users can read their Nest events" on public.nest_events;
create policy "Users can read their Nest events"
  on public.nest_events
  for select
  to authenticated
  using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'nest_events'
  ) then
    alter publication supabase_realtime add table public.nest_events;
  end if;
end $$;
