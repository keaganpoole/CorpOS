-- Extend the existing Phase 6 envelope-encryption boundary to People records.
-- This is additive: the established bigint people.id and all foreign keys stay
-- unchanged. encryption_record_id exists only to bind AES-GCM ciphertext to a
-- stable, non-guessable row identity.
begin;

alter table public.people
  add column if not exists encryption_record_id uuid;

update public.people
set encryption_record_id = gen_random_uuid()
where encryption_record_id is null;

alter table public.people
  alter column encryption_record_id set default gen_random_uuid(),
  alter column encryption_record_id set not null;

create unique index if not exists people_encryption_record_id_key
  on public.people(encryption_record_id);

alter table public.people
  add column if not exists security_revision bigint not null default 0;

drop trigger if exists phase6_security_revision on public.people;
create trigger phase6_security_revision
before update on public.people
for each row execute function nodemere_private.bump_security_revision();

create or replace function nodemere_private.guard_encrypted_people() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  f text;
  value jsonb;
  row_data jsonb := to_jsonb(new);
  old_data jsonb := case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  fields constant text[] := array[
    'first_name','last_name','phone','email','street_address','city','state','zip_code',
    'preferred_contact_method','preferred_language','best_time_to_contact','status','source',
    'lead_source_detail','tags','last_call_status','last_intent','last_outcome','last_sms_status',
    'last_email_status','assigned_staff','call_route','payment_status','invoice_id','notes',
    'special_instructions','stripe_customer_id','stripe_payment_method_id','custom_fields'
  ];
begin
  if tg_op='UPDATE' and (
    new.encryption_record_id is distinct from old.encryption_record_id
    or new.business_id is distinct from old.business_id
  ) then
    raise exception 'Protected record binding cannot be changed' using errcode='42501';
  end if;

  -- Compatibility remains possible until a business has a provisioned DEK.
  -- Once the key exists, every new or changed protected value must be an
  -- authenticated Nodemere envelope, even for service-role SQL.
  if not exists(
    select 1 from public.business_data_keys where business_id=new.business_id
  ) then
    return new;
  end if;

  foreach f in array fields loop
    value := row_data->f;
    if value is null or value='null'::jsonb
      or (tg_op='UPDATE' and value is not distinct from old_data->f) then
      continue;
    end if;
    if not (
      jsonb_typeof(value)='object' and value ? '_nodemere_envelope'
    ) and not (
      jsonb_typeof(value)='string' and (value #>> '{}') like 'ndmenc:v1:%'
    ) then
      raise exception 'Protected payload requires encryption' using errcode='42501';
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists phase6_require_encryption on public.people;
create trigger phase6_require_encryption
before insert or update on public.people
for each row execute function nodemere_private.guard_encrypted_people();

revoke all on function nodemere_private.guard_encrypted_people()
  from public,anon,authenticated,service_role;

-- These are server-managed concurrency/cryptographic binding fields and are
-- never part of a browser-visible People record.
revoke select (encryption_record_id,security_revision),
       insert (encryption_record_id,security_revision),
       update (encryption_record_id,security_revision)
on public.people from anon,authenticated;

notify pgrst,'reload schema';
commit;
