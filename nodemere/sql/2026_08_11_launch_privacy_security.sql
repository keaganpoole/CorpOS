-- Nodemere launch privacy, consent-evidence, and tenant-isolation migration.
-- Apply in Supabase SQL Editor with a service-role/owner connection before production deploy.

begin;

-- Preserve evidence of the permission relied on for automated calls or texts.
alter table public.people
  add column if not exists business_id bigint,
  add column if not exists consent_call_source text,
  add column if not exists consent_call_recorded_at timestamptz,
  add column if not exists consent_call_scope text,
  add column if not exists consent_sms_source text,
  add column if not exists consent_sms_recorded_at timestamptz,
  add column if not exists consent_sms_scope text;

update public.people p
set business_id = b.id
from public.businesses b
where p.business_id is null
  and p.user_id = b.user_id;

create index if not exists idx_people_user_id on public.people (user_id);
create index if not exists idx_people_business_id on public.people (business_id);
create index if not exists idx_people_call_consent_evidence
  on public.people (user_id, consent_call, do_not_call, consent_call_recorded_at desc);

alter table public.people enable row level security;
drop policy if exists "users can read own people" on public.people;
create policy "users can read own people" on public.people
for select using (auth.uid() = user_id);
drop policy if exists "users can insert own people" on public.people;
create policy "users can insert own people" on public.people
for insert with check (auth.uid() = user_id);
drop policy if exists "users can update own people" on public.people;
create policy "users can update own people" on public.people
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users can delete own people" on public.people;
create policy "users can delete own people" on public.people
for delete using (auth.uid() = user_id);

-- Direct browser access to receptionist and scenario configuration is limited
-- to the account owner. Server-side operations run through the service role.
alter table public.hired_receptionists
  add column if not exists user_id uuid;
alter table public.hired_receptionists enable row level security;
drop policy if exists "users can manage own hired receptionists" on public.hired_receptionists;
create policy "users can manage own hired receptionists" on public.hired_receptionists
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.scenarios
  add column if not exists user_id uuid;
alter table public.scenarios enable row level security;
drop policy if exists "users can manage own scenarios" on public.scenarios;
create policy "users can manage own scenarios" on public.scenarios
for all using (auth.uid() = user_id or auth.uid() = created_by)
with check (auth.uid() = user_id or auth.uid() = created_by);

-- Calls and payment records contain highly sensitive customer data.
alter table public.call_logs enable row level security;
drop policy if exists "users can read own call logs" on public.call_logs;
create policy "users can read own call logs" on public.call_logs
for select using (auth.uid() = user_id);

alter table public.payments
  add column if not exists user_id uuid,
  add column if not exists business_id bigint;
create index if not exists idx_payments_user_id_created_at
  on public.payments (user_id, created_at desc);
alter table public.payments enable row level security;
drop policy if exists "users can read own payments" on public.payments;
create policy "users can read own payments" on public.payments
for select using (auth.uid() = user_id);

-- The application does not currently persist customer-facing invoice records
-- in this table. Keep direct browser access closed until a user-scoped invoice
-- storage model and policy are implemented.
alter table public.invoices enable row level security;

-- Execution context, queue jobs, and scenario-event payloads are server-only.
alter table public.flow_executions
  add column if not exists user_id uuid,
  add column if not exists business_id bigint;
create index if not exists idx_flow_executions_user_id_started_at
  on public.flow_executions (user_id, started_at desc);
alter table public.flow_executions enable row level security;

alter table public.jobs enable row level security;
drop policy if exists "users can read own jobs" on public.jobs;
create policy "users can read own jobs" on public.jobs
for select using (auth.uid() = user_id);

alter table public.scenario_events enable row level security;
alter table public.checkpoints enable row level security;

commit;
