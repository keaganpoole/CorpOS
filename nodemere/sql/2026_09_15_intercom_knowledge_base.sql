-- Private cache of rendered Intercom documents and ElevenLabs document IDs.
-- Source business facts remain in businesses, services, and staff.
create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null references public.businesses(id) on delete cascade,
  document_type text not null check (document_type in ('policies', 'services', 'staff', 'about', 'faq', 'hours')),
  content text not null default '',
  version integer not null default 1,
  published boolean not null default true,
  elevenlabs_document_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, document_type)
);

create index if not exists knowledge_base_business_id_idx
  on public.knowledge_base (business_id);

-- The backend uses service_role. Do not expose business knowledge through
-- authenticated or anonymous PostgREST requests without explicit policies.
alter table public.knowledge_base enable row level security;
revoke all on public.knowledge_base from anon, authenticated;
grant select, insert, update on public.knowledge_base to service_role;

create or replace function public.nodemere_intercom_knowledge_ready()
returns boolean
language sql
security definer
set search_path = pg_catalog
as $$
  select coalesce((
    select c.relrowsecurity
    from pg_class c
    where c.oid = 'public.knowledge_base'::regclass
  ), false);
$$;

revoke all on function public.nodemere_intercom_knowledge_ready() from public, anon, authenticated;
grant execute on function public.nodemere_intercom_knowledge_ready() to service_role;
