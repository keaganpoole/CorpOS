alter table public.businesses
  add column if not exists people_field_config jsonb not null default '{}'::jsonb;
