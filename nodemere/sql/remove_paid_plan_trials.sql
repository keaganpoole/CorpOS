-- Paid plans charge immediately. The Free plan is the product trial.
-- Apply this after create_plans_table.sql to update existing plan records.

begin;

update public.sonar_plans
set display = coalesce(display, '{}'::jsonb) || '{"cta":"Start plan"}'::jsonb,
    updated_at = now()
where slug in ('essentials', 'pro', 'ultra');

commit;
