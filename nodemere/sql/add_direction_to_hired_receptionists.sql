alter table public.hired_receptionists
add column if not exists direction text not null default 'all';

update public.hired_receptionists
set direction = 'all'
where direction is null
   or lower(direction) not in ('inbound', 'outbound', 'all', 'none');

do $$
begin
  alter table public.hired_receptionists
  drop constraint if exists hired_receptionists_direction_check;

  alter table public.hired_receptionists
  add constraint hired_receptionists_direction_check
  check (direction in ('inbound', 'outbound', 'all', 'none'));
end $$;
