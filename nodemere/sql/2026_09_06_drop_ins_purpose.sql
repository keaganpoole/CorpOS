begin;

-- Existing definitions retain a concise purpose based on their button name.
alter table public.drop_ins add column if not exists purpose text;
update public.drop_ins set purpose = left(btrim(name), 30) where purpose is null;
alter table public.drop_ins alter column purpose set not null;
alter table public.drop_ins drop constraint if exists drop_ins_purpose_check;
alter table public.drop_ins add constraint drop_ins_purpose_check
  check (length(btrim(purpose)) between 1 and 30);

notify pgrst, 'reload schema';
commit;
