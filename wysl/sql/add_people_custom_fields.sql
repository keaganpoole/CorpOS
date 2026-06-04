-- Recommended storage model for user-defined People fields.
-- Field definitions live separately from row values, while each person stores
-- flexible values in a JSONB object keyed by people_field_definitions.field_key.

alter table public.people
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

create table if not exists public.people_field_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.users(id) on delete cascade,
  business_id bigint null,
  field_key text not null,
  label text not null,
  field_type text not null check (field_type in ('boolean', 'text', 'number', 'date')),
  position integer not null default 0,
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_field_definitions_field_key_format
    check (field_key ~ '^custom_[a-z0-9_]+$'),
  constraint people_field_definitions_scope_key_unique
    unique (user_id, business_id, field_key)
);

create index if not exists idx_people_custom_fields_gin
  on public.people using gin (custom_fields);

create index if not exists idx_people_field_definitions_scope
  on public.people_field_definitions (user_id, business_id, position);
