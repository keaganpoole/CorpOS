-- Renames the staff transfer availability flag to the escalations field.
alter table public.staff rename column receives_escalated_calls to escalations;
