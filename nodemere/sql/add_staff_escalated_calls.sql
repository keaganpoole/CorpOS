-- Controls whether a staff member can receive calls escalated by the receptionist.
alter table public.staff add column if not exists escalations boolean not null default true;
alter table public.staff add column if not exists escalation_hours jsonb not null default '{}'::jsonb;
