-- ONLY run in a disposable, empty PostgreSQL cluster. Never run against Supabase.
-- Invoke psql with -v ON_ERROR_STOP=1 -v phase1_disposable=yes.
\if :{?phase1_disposable}
\else
\echo 'Refusing: this fixture requires an explicitly disposable database.'
\quit
\endif

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;

create table public.payments(id integer primary key, user_id uuid, business_id bigint, description text);
create table public.flow_executions(id integer primary key, user_id uuid, flow_context jsonb);
create table public.integrations(id integer primary key, user_id uuid, credentials jsonb);
create table public.jobs(id integer primary key);
create function public.claim_due_scenario_jobs(worker_id text, batch_size integer default 10)
  returns setof public.jobs language sql security definer as $$ select * from public.jobs $$;

insert into public.payments values
  (1, '11111111-1111-4111-8111-111111111111', 1, 'Synthetic A'),
  (2, '22222222-2222-4222-8222-222222222222', 2, 'Synthetic B'),
  (3, null, null, 'Synthetic unowned');
insert into public.flow_executions values (1, '11111111-1111-4111-8111-111111111111', '{}');
insert into public.integrations values (1, '11111111-1111-4111-8111-111111111111', '{"synthetic":true}');
insert into public.jobs values (1);

-- Reproduce excessively broad historical table, column and policy grants.
grant all on all tables in schema public to public, anon, authenticated;
grant select(id), update(description) on public.payments to anon, authenticated;
grant select(credentials), update(credentials) on public.integrations to anon, authenticated;
create policy historical_allow_everything on public.payments for all using (true) with check (true);
create policy historical_allow_everything on public.flow_executions for all using (true) with check (true);
create policy historical_allow_everything on public.integrations for all using (true) with check (true);

\ir ../sql/2026_09_03_phase1_security_containment.sql
-- Idempotence: a second application must succeed.
\ir ../sql/2026_09_03_phase1_security_containment.sql

do $$
begin
  assert not has_any_column_privilege('anon', 'public.payments', 'select'), 'anonymous payment columns exposed';
  assert not has_any_column_privilege('anon', 'public.flow_executions', 'select'), 'anonymous execution columns exposed';
  assert not has_any_column_privilege('authenticated', 'public.integrations', 'select'), 'integration credentials exposed';
  assert not has_any_column_privilege('authenticated', 'public.integrations', 'update'), 'integration credentials writable';
  assert not has_function_privilege('anon', 'public.claim_due_scenario_jobs(text,integer)', 'execute'), 'anonymous worker RPC';
  assert not has_function_privilege('authenticated', 'public.claim_due_scenario_jobs(text,integer)', 'execute'), 'client worker RPC';
  assert has_function_privilege('service_role', 'public.claim_due_scenario_jobs(text,integer)', 'execute'), 'worker RPC unavailable';
end $$;

set role anon;
do $$
begin
  begin perform id from public.payments; raise exception 'Anonymous SELECT unexpectedly allowed';
    exception when insufficient_privilege then null; end;
  begin perform id from public.flow_executions; raise exception 'Anonymous execution SELECT unexpectedly allowed';
    exception when insufficient_privilege then null; end;
  begin perform * from public.claim_due_scenario_jobs('attacker'); raise exception 'Anonymous RPC unexpectedly allowed';
    exception when insufficient_privilege then null; end;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$
begin
  assert (select count(*) = 1 and min(id) = 1 from public.payments), 'Owner A isolation failed';
  begin update public.payments set description = 'attack'; raise exception 'Client payment UPDATE unexpectedly allowed';
    exception when insufficient_privilege then null; end;
  begin insert into public.payments values (4, auth.uid(), 1, 'attack'); raise exception 'Client INSERT unexpectedly allowed';
    exception when insufficient_privilege then null; end;
  begin delete from public.payments; raise exception 'Client DELETE unexpectedly allowed';
    exception when insufficient_privilege then null; end;
  begin perform credentials from public.integrations; raise exception 'Client credential SELECT unexpectedly allowed';
    exception when insufficient_privilege then null; end;
  begin perform * from public.claim_due_scenario_jobs('attacker'); raise exception 'Client RPC unexpectedly allowed';
    exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$ begin
  assert (select count(*) = 1 and min(id) = 2 from public.payments), 'Owner B isolation failed';
end $$;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
do $$ begin
  assert (select count(*) = 0 from public.payments), 'Unknown user can read payment data';
end $$;
reset role;

-- Even an accidental later regrant must not defeat restrictive RLS guards.
grant select, insert, update, delete on public.payments, public.flow_executions, public.integrations to anon, authenticated;
set role anon;
do $$ begin
  assert (select count(*) = 0 from public.payments), 'Anonymous restrictive policy failed';
  assert (select count(*) = 0 from public.flow_executions), 'Execution restrictive policy failed';
  assert (select count(*) = 0 from public.integrations), 'Integration restrictive policy failed';
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$
declare changed integer;
begin
  assert (select count(*) = 1 from public.payments), 'Historical permissive policy defeated owner guard';
  assert (select count(*) = 0 from public.flow_executions), 'Client execution restrictive policy failed';
  assert (select count(*) = 0 from public.integrations), 'Client integration restrictive policy failed';
  update public.payments set description = 'attack';
  get diagnostics changed = row_count;
  assert changed = 0, 'Client update defeated restrictive policy';
  delete from public.payments;
  get diagnostics changed = row_count;
  assert changed = 0, 'Client delete defeated restrictive policy';
  begin insert into public.payments values (4, auth.uid(), 1, 'attack');
    raise exception 'Client insert defeated restrictive policy';
    exception when insufficient_privilege then null; end;
end $$;
reset role;
\ir ../sql/2026_09_03_phase1_security_containment.sql

set role service_role;
do $$ begin
  assert (select count(*) = 3 from public.payments), 'Backend payment access broken';
  assert (select count(*) = 1 from public.flow_executions), 'Backend execution access broken';
  assert (select count(*) = 1 from public.integrations), 'Backend integration access broken';
  assert (select count(*) = 1 from public.claim_due_scenario_jobs('worker')), 'Backend RPC broken';
  update public.integrations set credentials = '{"synthetic":"updated"}' where id = 1;
  assert (select credentials->>'synthetic' = 'updated' from public.integrations where id = 1), 'Backend credential write failed';
end $$;
reset role;
\echo 'PASS: Phase 1 RLS/grant isolation, old-policy resistance, backend access and idempotence'
