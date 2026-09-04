-- Phase 1 only. Apply with the database owner in Supabase SQL Editor.
-- No row data, billing flags, roles, MFA or encryption are changed.
-- Execution context and integration credentials are backend-only. The existing
-- dashboard uses authenticated API routes for both tables.
-- Payments retain owner-scoped browser SELECT for scenario variables.
begin;

alter table public.flow_executions enable row level security;
alter table public.integrations enable row level security;
alter table public.payments enable row level security;

revoke all on table public.flow_executions, public.integrations
  from public, anon, authenticated;
revoke all on table public.payments from public, anon, authenticated;

-- REVOKE table privileges does not remove independently granted column
-- privileges. Remove those too, including historical grants.
do $$
declare
  target_table text;
  columns_sql text;
begin
  foreach target_table in array array['flow_executions', 'integrations', 'payments']
  loop
    select string_agg(quote_ident(attname), ', ' order by attnum)
      into columns_sql
      from pg_attribute
      where attrelid = format('public.%I', target_table)::regclass
        and attnum > 0 and not attisdropped;
    execute format(
      'revoke select (%1$s), insert (%1$s), update (%1$s), references (%1$s) on table public.%2$I from public, anon, authenticated',
      columns_sql, target_table
    );
  end loop;
end;
$$;

-- Restrictive policies are ANDed with any existing permissive policies. Old
-- permissive policies cannot reopen these paths if privileges are regranted.
drop policy if exists phase1_server_only on public.flow_executions;
create policy phase1_server_only on public.flow_executions
  as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists phase1_server_only on public.integrations;
create policy phase1_server_only on public.integrations
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists phase1_payments_no_anon on public.payments;
create policy phase1_payments_no_anon on public.payments
  as restrictive for all to anon using (false) with check (false);
drop policy if exists phase1_payments_owner_guard on public.payments;
create policy phase1_payments_owner_guard on public.payments
  as restrictive for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists phase1_payments_owner_read on public.payments;
create policy phase1_payments_owner_read on public.payments
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists phase1_payments_no_insert on public.payments;
create policy phase1_payments_no_insert on public.payments
  as restrictive for insert to authenticated with check (false);
drop policy if exists phase1_payments_no_update on public.payments;
create policy phase1_payments_no_update on public.payments
  as restrictive for update to authenticated using (false) with check (false);
drop policy if exists phase1_payments_no_delete on public.payments;
create policy phase1_payments_no_delete on public.payments
  as restrictive for delete to authenticated using (false);
grant select on table public.payments to authenticated;

-- Explicitly preserve backend access (service_role bypasses RLS).
grant select, insert, update, delete on table
  public.flow_executions, public.integrations, public.payments to service_role;

-- This SECURITY DEFINER worker function must never be callable by browsers.
revoke all on function public.claim_due_scenario_jobs(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_scenario_jobs(text, integer) to service_role;

notify pgrst, 'reload schema';
commit;
