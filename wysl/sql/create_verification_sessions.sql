create table if not exists public.verification_sessions (
  id uuid primary key default gen_random_uuid(),
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
  updated_at timestamptz not null default timezone('utc', now()),
  constraint verification_sessions_status_check check (status in ('pending', 'verified', 'expired'))
);

create index if not exists verification_sessions_business_id_created_at_idx
  on public.verification_sessions (business_id, created_at desc);
create index if not exists verification_sessions_status_expires_at_idx
  on public.verification_sessions (status, expires_at);

alter table public.verification_sessions enable row level security;

comment on table public.verification_sessions is
  'Short-lived identity verification sessions. Raw tokens are never stored.';
