-- Overage billing ledger and account lifecycle controls.
-- Apply this migration before enabling the corresponding backend routes.

begin;

alter table public.users
  add column if not exists account_status text not null default 'active',
  add column if not exists closed_at timestamptz null,
  add column if not exists deletion_requested_at timestamptz null;

update public.users
set account_status = 'active'
where account_status is null
   or account_status not in ('active', 'closed', 'pending_deletion');

alter table public.users alter column account_status set not null;

alter table public.users
  drop constraint if exists users_account_status_check;

alter table public.users
  add constraint users_account_status_check
  check (account_status in ('active', 'closed', 'pending_deletion'));

create table if not exists public.billing_overage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id bigint null references public.businesses(id) on delete set null,
  stripe_customer_id text not null,
  stripe_invoice_id text not null,
  stripe_invoice_item_id text null,
  billing_period_start timestamptz null,
  billing_period_end timestamptz null,
  overage_seconds bigint not null default 0,
  billable_minutes bigint not null default 0,
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  status text not null default 'pending',
  error_message text null,
  created_at timestamptz not null default now(),
  reconciled_at timestamptz null,
  constraint billing_overage_events_status_check
    check (status in ('pending', 'invoiced', 'paid', 'failed', 'void')),
  constraint billing_overage_events_invoice_unique
    unique (user_id, stripe_invoice_id)
);

create index if not exists billing_overage_events_user_created_idx
  on public.billing_overage_events (user_id, created_at desc);

create table if not exists public.account_data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null,
  status text not null default 'requested',
  details text null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint account_data_requests_type_check
    check (request_type in ('access', 'deletion', 'correction')),
  constraint account_data_requests_status_check
    check (status in ('requested', 'processing', 'completed', 'rejected'))
);

create index if not exists account_data_requests_user_created_idx
  on public.account_data_requests (user_id, created_at desc);

alter table public.billing_overage_events enable row level security;
alter table public.account_data_requests enable row level security;

drop policy if exists "users can view own overage events" on public.billing_overage_events;
create policy "users can view own overage events"
  on public.billing_overage_events for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can view own data requests" on public.account_data_requests;
create policy "users can view own data requests"
  on public.account_data_requests for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on table public.billing_overage_events from anon, authenticated;
revoke insert, update, delete on table public.account_data_requests from anon, authenticated;

commit;
