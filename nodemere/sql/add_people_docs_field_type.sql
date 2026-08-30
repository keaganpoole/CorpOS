alter table public.people_schema
  drop constraint if exists people_schema_field_type_check;

alter table public.people_schema
  add constraint people_schema_field_type_check
  check (field_type in ('boolean', 'text', 'number', 'date', 'select', 'multi_select', 'docs'));
