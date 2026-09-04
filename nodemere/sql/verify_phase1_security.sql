-- Read-only verification, using an owner/admin connection after containment.
-- All boolean checks should be true. No customer data is returned.
select
  not has_table_privilege('anon', 'public.payments', 'select') as anon_payments_blocked,
  not has_any_column_privilege('anon', 'public.payments', 'select') as anon_payment_columns_blocked,
  not has_table_privilege('anon', 'public.flow_executions', 'select') as anon_executions_blocked,
  not has_any_column_privilege('authenticated', 'public.integrations', 'select') as client_credentials_blocked,
  not has_table_privilege('authenticated', 'public.integrations', 'update') as client_integration_updates_blocked,
  has_table_privilege('authenticated', 'public.payments', 'select') as owner_payment_read_granted,
  not has_function_privilege('anon', 'public.claim_due_scenario_jobs(text,integer)', 'execute') as anon_worker_blocked,
  not has_function_privilege('authenticated', 'public.claim_due_scenario_jobs(text,integer)', 'execute') as client_worker_blocked,
  has_function_privilege('service_role', 'public.claim_due_scenario_jobs(text,integer)', 'execute') as worker_access_preserved;

select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('payments','flow_executions','integrations');

select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('payments','flow_executions','integrations')
order by tablename, policyname;
