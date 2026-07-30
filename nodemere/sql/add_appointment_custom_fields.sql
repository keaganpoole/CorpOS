alter table public.appointments
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

alter table public.appointments
  add column if not exists source text null;

create index if not exists idx_appointments_custom_fields_gin
  on public.appointments using gin (custom_fields);
