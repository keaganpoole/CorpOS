-- Rename legacy staff escalation fields to current column names.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'staff' and column_name = 'handoff'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'staff' and column_name = 'escalations'
  ) then
    alter table public.staff rename column handoff to escalations;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'staff' and column_name = 'handoff_hours'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'staff' and column_name = 'escalation_hours'
  ) then
    alter table public.staff rename column handoff_hours to escalation_hours;
  end if;
end $$;

alter table public.staff add column if not exists escalations boolean not null default true;
alter table public.staff add column if not exists escalation_hours jsonb not null default '{}'::jsonb;
