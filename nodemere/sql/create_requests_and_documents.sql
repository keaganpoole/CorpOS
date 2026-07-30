-- Shared caller-link requests. Run once in the Supabase SQL editor.
do $$
begin
  if to_regclass('public.requests') is null and to_regclass('public.verification_sessions') is not null then
    alter table public.verification_sessions rename to requests;
  end if;
end $$;

do $$
begin
  if to_regclass('public.people_docs') is null and to_regclass('public.person_documents') is not null then
    alter table public.person_documents rename to people_docs;
  end if;
end $$;

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null default 'auth',
  business_id bigint null,
  person_id bigint null,
  phone text null,
  user_id uuid null,
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  completed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.requests add column if not exists request_type text;
alter table public.requests alter column request_type set default 'auth';
update public.requests set request_type = 'auth' where request_type is null;
alter table public.requests alter column request_type set not null;

alter table public.requests drop constraint if exists verification_sessions_status_check;
alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests add constraint requests_status_check
  check (status in ('pending', 'verified', 'completed', 'expired', 'cancelled'));

create index if not exists requests_business_type_created_at_idx
  on public.requests (business_id, request_type, created_at desc);
create index if not exists requests_status_expires_at_idx
  on public.requests (status, expires_at);
alter table public.requests enable row level security;

create table if not exists public.people_docs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete restrict,
  business_id bigint null,
  person_id bigint null,
  file_name text not null,
  storage_bucket text not null default 'caller-documents',
  storage_path text not null unique,
  content_type text not null,
  file_size bigint not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists people_docs_business_person_created_at_idx
  on public.people_docs (business_id, person_id, created_at desc);
create index if not exists people_docs_request_id_idx
  on public.people_docs (request_id);
alter table public.people_docs enable row level security;

insert into storage.buckets (id, name, public)
values ('caller-documents', 'caller-documents', false)
on conflict (id) do nothing;

comment on table public.requests is 'Short-lived caller-facing requests. Raw tokens are never stored.';
comment on table public.people_docs is 'Files uploaded by a person through a caller-facing request.';
