-- Versioned, immutable evidence for each affirmative voice-clone authorization.
-- Run after sql/create_voice_contracts.sql.

create table if not exists public.voice_clone_consents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  user_id uuid null,
  business_id bigint null,
  voice_owner_name text null,
  voice_owner_email text null,
  consent_key text not null check (consent_key in ('voice', 'identity', 'usage')),
  agreement_title text not null,
  agreement_version text not null,
  agreement_snapshot text not null,
  agreement_text_hash text not null,
  provider_identifier text null,
  provider_voice_id text null,
  recording_manifest jsonb not null default '[]'::jsonb,
  voice_verification_result text null,
  status text not null default 'accepted' check (status in ('accepted', 'superseded', 'withdrawn')),
  accepted_at timestamptz not null default timezone('utc', now()),
  accepted_ip text null,
  accepted_user_agent text null,
  final_signature_at timestamptz null,
  signature_storage_bucket text null,
  signature_storage_path text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists voice_clone_consents_current_acceptance_key
  on public.voice_clone_consents (contract_id, consent_key, agreement_version, agreement_text_hash)
  where status = 'accepted';

create index if not exists voice_clone_consents_contract_id_idx
  on public.voice_clone_consents (contract_id, accepted_at desc);

alter table public.voice_clone_consents enable row level security;

alter table public.contracts add column if not exists final_certification_at timestamptz null;
alter table public.contracts add column if not exists removal_requested_at timestamptz null;
alter table public.contracts add column if not exists removal_acknowledged_at timestamptz null;
alter table public.contracts add column if not exists removal_deadline_at timestamptz null;
alter table public.contracts add column if not exists voice_disabled_at timestamptz null;
alter table public.contracts add column if not exists provider_deletion_requested_at timestamptz null;
alter table public.contracts add column if not exists provider_deletion_confirmed_at timestamptz null;
alter table public.contracts add column if not exists removal_status text null;
