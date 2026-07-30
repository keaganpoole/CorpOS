alter table public.hired_receptionists
add column if not exists gender text;

update public.hired_receptionists as hr
set gender = rc.gender
from public.receptionist_catalog as rc
where hr.catalog_id = rc.id
  and (hr.gender is null or hr.gender = '');
