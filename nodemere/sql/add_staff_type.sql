-- Distinguishes operational team members from human-transfer representatives.
alter table public.staff add column if not exists staff_type text not null default 'team_member';
alter table public.staff drop constraint if exists staff_staff_type_check;
update public.staff set staff_type = 'transfer_contact' where staff_type = 'authorized_representative';
alter table public.staff add constraint staff_staff_type_check
  check (staff_type in ('team_member', 'transfer_contact', 'both'));
