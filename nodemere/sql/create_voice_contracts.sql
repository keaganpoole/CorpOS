-- Voice consent contracts and custom ElevenLabs IVC records.
-- Run once in the Supabase SQL editor.

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  status text not null default 'draft',
  business_id bigint null,
  person_id bigint null,
  user_id uuid null,
  signer_name text null,
  signer_email text null,
  voice_display_name text null,
  agreement_version text not null default 'voice-consent-v1',
  agreement_body text not null,
  consent jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  signature_storage_bucket text null,
  signature_storage_path text null,
  signed_pdf_bucket text null,
  signed_pdf_path text null,
  signer_ip text null,
  signer_user_agent text null,
  elevenlabs_voice_id text null,
  signed_at timestamptz null,
  clone_completed_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint contracts_status_check check (status in ('draft', 'signed', 'cloned', 'revoked', 'expired'))
);

alter table public.contracts add column if not exists token_hash text;
alter table public.contracts add column if not exists status text default 'draft';
alter table public.contracts add column if not exists business_id bigint;
alter table public.contracts add column if not exists person_id bigint;
alter table public.contracts add column if not exists user_id uuid;
alter table public.contracts add column if not exists signer_name text;
alter table public.contracts add column if not exists signer_email text;
alter table public.contracts add column if not exists voice_display_name text;
alter table public.contracts add column if not exists agreement_version text default 'voice-consent-v1';
alter table public.contracts add column if not exists agreement_body text;
alter table public.contracts add column if not exists consent jsonb default '{}'::jsonb;
alter table public.contracts add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.contracts add column if not exists signature_storage_bucket text;
alter table public.contracts add column if not exists signature_storage_path text;
alter table public.contracts add column if not exists signed_pdf_bucket text;
alter table public.contracts add column if not exists signed_pdf_path text;
alter table public.contracts add column if not exists signer_ip text;
alter table public.contracts add column if not exists signer_user_agent text;
alter table public.contracts add column if not exists elevenlabs_voice_id text;
alter table public.contracts add column if not exists signed_at timestamptz;
alter table public.contracts add column if not exists clone_completed_at timestamptz;
alter table public.contracts add column if not exists expires_at timestamptz;
alter table public.contracts add column if not exists created_at timestamptz default timezone('utc', now());
alter table public.contracts add column if not exists updated_at timestamptz default timezone('utc', now());

alter table public.contracts alter column status set not null;
alter table public.contracts alter column agreement_version set not null;
alter table public.contracts alter column consent set not null;
alter table public.contracts alter column metadata set not null;
alter table public.contracts alter column created_at set not null;
alter table public.contracts alter column updated_at set not null;

create unique index if not exists contracts_token_hash_key on public.contracts (token_hash);
create index if not exists contracts_business_created_at_idx on public.contracts (business_id, created_at desc);
create index if not exists contracts_status_expires_at_idx on public.contracts (status, expires_at);
create index if not exists contracts_signer_email_idx on public.contracts (lower(signer_email));
alter table public.contracts enable row level security;

create table if not exists public.custom_voices (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  business_id bigint null,
  person_id bigint null,
  user_id uuid null,
  provider text not null default 'elevenlabs',
  provider_voice_id text null,
  voice_name text not null,
  speaker_name text null,
  speaker_email text null,
  status text not null default 'pending',
  sample_count integer not null default 0,
  sample_storage_paths jsonb not null default '[]'::jsonb,
  provider_response jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  disabled_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint custom_voices_status_check check (status in ('pending', 'ready', 'requires_verification', 'failed', 'revoked', 'disabled'))
);

alter table public.custom_voices add column if not exists contract_id uuid references public.contracts(id) on delete restrict;
alter table public.custom_voices add column if not exists business_id bigint;
alter table public.custom_voices add column if not exists person_id bigint;
alter table public.custom_voices add column if not exists user_id uuid;
alter table public.custom_voices add column if not exists provider text default 'elevenlabs';
alter table public.custom_voices add column if not exists provider_voice_id text;
alter table public.custom_voices add column if not exists voice_name text;
alter table public.custom_voices add column if not exists speaker_name text;
alter table public.custom_voices add column if not exists speaker_email text;
alter table public.custom_voices add column if not exists status text default 'pending';
alter table public.custom_voices add column if not exists sample_count integer default 0;
alter table public.custom_voices add column if not exists sample_storage_paths jsonb default '[]'::jsonb;
alter table public.custom_voices add column if not exists provider_response jsonb default '{}'::jsonb;
alter table public.custom_voices add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.custom_voices add column if not exists disabled_at timestamptz;
alter table public.custom_voices add column if not exists created_at timestamptz default timezone('utc', now());
alter table public.custom_voices add column if not exists updated_at timestamptz default timezone('utc', now());

alter table public.custom_voices alter column contract_id set not null;
alter table public.custom_voices alter column provider set not null;
alter table public.custom_voices alter column voice_name set not null;
alter table public.custom_voices alter column status set not null;
alter table public.custom_voices alter column sample_count set not null;
alter table public.custom_voices alter column sample_storage_paths set not null;
alter table public.custom_voices alter column provider_response set not null;
alter table public.custom_voices alter column metadata set not null;
alter table public.custom_voices alter column created_at set not null;
alter table public.custom_voices alter column updated_at set not null;

create index if not exists custom_voices_contract_id_idx on public.custom_voices (contract_id);
create index if not exists custom_voices_provider_voice_id_idx on public.custom_voices (provider, provider_voice_id);
create index if not exists custom_voices_business_created_at_idx on public.custom_voices (business_id, created_at desc);
alter table public.custom_voices enable row level security;

insert into storage.buckets (id, name, public)
values ('voice-contracts', 'voice-contracts', false)
on conflict (id) do nothing;

comment on table public.contracts is 'Tokenized voice consent agreements. Raw link tokens are never stored.';
comment on table public.custom_voices is 'Custom voice records created after a signed voice consent contract.';
