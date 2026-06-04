create table if not exists public.scenario_events (
  id uuid primary key default gen_random_uuid(),
  trigger_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists scenario_events_trigger_key_created_at_idx
  on public.scenario_events (trigger_key, created_at desc);

alter table public.scenario_events replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.scenario_events;
exception when duplicate_object then null;
end $$;
