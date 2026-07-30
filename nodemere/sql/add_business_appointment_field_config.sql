alter table public.businesses
  add column if not exists appointments_field_config jsonb not null default '{}'::jsonb;
