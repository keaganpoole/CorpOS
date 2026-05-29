-- User-defined People fields.
-- people_schema stores one custom column definition per business.
-- people.custom_fields stores per-person values keyed by people_schema.field_key.

alter table public.people
  add column if not exists business_id bigint references public.businesses(id) on delete cascade;

alter table public.people
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

create table if not exists public.people_schema (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null references public.businesses(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null check (field_type in ('boolean', 'text', 'number', 'date')),
  position integer not null default 0,
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_schema_field_key_format
    check (field_key ~ '^custom_[a-z0-9_]+$'),
  constraint people_schema_business_field_key_unique
    unique (business_id, field_key)
);

create index if not exists idx_people_custom_fields_gin
  on public.people using gin (custom_fields);

create index if not exists idx_people_schema_business_position
  on public.people_schema (business_id, position);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_people_schema_updated_at on public.people_schema;

create trigger trg_people_schema_updated_at
before update on public.people_schema
for each row
execute function public.set_updated_at();
