-- Complete application-level envelope coverage for fields that may contain
-- PHI, regulated content, credentials, contact details, or free-form payloads.
-- Operational IDs, foreign keys, status, timestamps, counters and routing
-- identifiers intentionally remain queryable.
begin;

alter table public.businesses add column if not exists encryption_record_id uuid;
update public.businesses set encryption_record_id=gen_random_uuid() where encryption_record_id is null;
alter table public.businesses
  alter column encryption_record_id set default gen_random_uuid(),
  alter column encryption_record_id set not null;
create unique index if not exists businesses_encryption_record_id_key
  on public.businesses(encryption_record_id);

-- Persist a trusted tenant binding outside the event payload before that
-- payload becomes randomized ciphertext.
alter table public.scenario_events add column if not exists business_id bigint references public.businesses(id);
update public.scenario_events e
set business_id=(e.payload->>'business_id')::bigint
where e.business_id is null and e.payload->>'business_id' ~ '^[0-9]+$'
  and exists(select 1 from public.businesses b where b.id=(e.payload->>'business_id')::bigint);
update public.scenario_events e
set business_id=b.id
from public.businesses b
where e.business_id is null and e.payload->>'user_id' is not null
  and b.user_id::text=e.payload->>'user_id';
update public.scenario_events e
set business_id=p.business_id
from public.people p
where e.business_id is null and e.payload->>'person_id' ~ '^[0-9]+$'
  and p.id=(e.payload->>'person_id')::bigint;
do $$ begin
  if exists(select 1 from public.scenario_events where business_id is null) then
    raise exception 'Unresolved scenario event tenant; migration stopped';
  end if;
end $$;
alter table public.scenario_events alter column business_id set not null;
create index if not exists scenario_events_business_created_idx
  on public.scenario_events(business_id,created_at desc);

do $$ declare t text; begin
  foreach t in array array[
    'businesses','appointments','call_logs','flow_executions','integrations',
    'requests','people_docs','contracts','custom_voices','scenarios','jobs',
    'scenario_events','payments','invoices','staff','bugs'
  ] loop
    execute format('alter table public.%I add column if not exists security_revision bigint not null default 0',t);
    execute format('drop trigger if exists phase6_security_revision on public.%I',t);
    execute format('create trigger phase6_security_revision before update on public.%I for each row execute function nodemere_private.bump_security_revision()',t);
  end loop;
end $$;

create or replace function nodemere_private.guard_encrypted_payload() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  business bigint;
  fields text[];
  f text;
  value jsonb;
  row_data jsonb:=to_jsonb(new);
  old_data jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
begin
  case tg_table_name
    when 'businesses' then
      business:=new.id;
      fields:=array['phone','email','address','city','state','zip','about_us','policies','faq'];
    when 'appointments' then
      business:=new.business_id; fields:=array['notes','custom_fields'];
    when 'call_logs' then
      business:=new.business_id;
      fields:=array['caller_phone','caller_name','from_number','to_number','notes','summary',
        'transcript_jsonb','transcript_text','call_report','analysis_results',
        'conversation_initiation_data','conversation_metadata','telephony_metadata','failure_reason'];
    when 'flow_executions' then
      business:=new.business_id; fields:=array['flow_context','pause_data','trigger_event'];
    when 'integrations' then
      select case when count(*)=1 then min(id) end into business
      from public.businesses where user_id=new.user_id;
      fields:=array['credentials'];
    when 'requests' then
      business:=new.business_id; fields:=array['phone','metadata'];
    when 'people_docs' then
      business:=new.business_id; fields:=array['file_name','metadata'];
    when 'contracts' then
      business:=new.business_id;
      fields:=array['signer_name','signer_email','voice_display_name','agreement_body','consent',
        'metadata','signer_ip','signer_user_agent'];
    when 'custom_voices' then
      business:=new.business_id;
      fields:=array['voice_name','speaker_name','speaker_email','sample_storage_paths','provider_response','metadata'];
    when 'scenarios' then
      business:=new.business_id;
      fields:=array['name','description','nodes_data','edges_data','assigned_to','notes','schedule_config'];
    when 'jobs' then
      business:=new.business_id; fields:=array['schedule_config','payload','last_error'];
    when 'scenario_events' then
      business:=new.business_id; fields:=array['payload'];
    when 'payments' then
      business:=new.business_id; fields:=array['description','receipt_url','error_message','metadata'];
    when 'invoices' then
      select case when count(*)=1 then min(id) end into business
      from public.businesses where user_id=new.user_id;
      fields:=array['hosted_invoice_url','invoice_pdf','description','metadata','raw_stripe_invoice'];
    when 'staff' then
      business:=new.business_id;
      fields:=array['full_name','first_name','last_name','email','phone','knowledge','working_hours','acknowledgements'];
    when 'bugs' then
      business:=new.business_id; fields:=array['description','page','user_agent'];
    else
      raise exception 'Unsupported protected table' using errcode='42501';
  end case;

  if business is null then
    raise exception 'Protected record requires a trusted business' using errcode='42501';
  end if;
  if tg_op='UPDATE' then
    if tg_table_name='businesses' and (
      row_data->'id' is distinct from old_data->'id'
      or row_data->'encryption_record_id' is distinct from old_data->'encryption_record_id'
    ) then raise exception 'Protected record binding cannot be changed' using errcode='42501'; end if;
    if tg_table_name in ('integrations','invoices') and row_data->'user_id' is distinct from old_data->'user_id'
      then raise exception 'Protected record binding cannot be changed' using errcode='42501'; end if;
    if tg_table_name not in ('businesses','integrations','invoices')
      and row_data->'business_id' is distinct from old_data->'business_id'
      then raise exception 'Protected record binding cannot be changed' using errcode='42501'; end if;
  end if;

  foreach f in array fields loop
    value:=row_data->f;
    if value is null or value='null'::jsonb
      or (tg_op='UPDATE' and value is not distinct from old_data->f) then continue; end if;
    -- Browser clients use authenticated APIs for protected values. Refusing
    -- even envelope-shaped input here prevents a client from replacing data
    -- with forged ciphertext that the server can never decrypt.
    if current_setting('role',true) in ('anon','authenticated') then
      raise exception 'Protected field is API-only' using errcode='42501';
    end if;
    if not (jsonb_typeof(value)='object' and value ? '_nodemere_envelope') and not
      (jsonb_typeof(value)='string' and (value #>> '{}') like 'ndmenc:v1:%') then
      raise exception 'Protected payload requires encryption' using errcode='42501';
    end if;
  end loop;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array[
    'businesses','appointments','call_logs','flow_executions','integrations',
    'requests','people_docs','contracts','custom_voices','scenarios','jobs',
    'scenario_events','payments','invoices','staff','bugs'
  ] loop
    execute format('drop trigger if exists phase6_require_encryption on public.%I',t);
    execute format('create trigger phase6_require_encryption before insert or update on public.%I for each row execute function nodemere_private.guard_encrypted_payload()',t);
  end loop;
end $$;
revoke all on function nodemere_private.guard_encrypted_payload()
  from public,anon,authenticated,service_role;

-- Remove the earlier People migration's compatibility window now that every
-- existing People value has been backfilled and the server key is active.
create or replace function nodemere_private.guard_encrypted_people() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  f text;
  value jsonb;
  row_data jsonb:=to_jsonb(new);
  old_data jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  fields constant text[]:=array[
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
  ) then raise exception 'Protected record binding cannot be changed' using errcode='42501'; end if;
  foreach f in array fields loop
    value:=row_data->f;
    if value is null or value='null'::jsonb
      or (tg_op='UPDATE' and value is not distinct from old_data->f) then continue; end if;
    if current_setting('role',true) in ('anon','authenticated') then
      raise exception 'Protected field is API-only' using errcode='42501';
    end if;
    if not (jsonb_typeof(value)='object' and value ? '_nodemere_envelope') and not
      (jsonb_typeof(value)='string' and (value #>> '{}') like 'ndmenc:v1:%') then
      raise exception 'Protected payload requires encryption' using errcode='42501';
    end if;
  end loop;
  return new;
end $$;
revoke all on function nodemere_private.guard_encrypted_people()
  from public,anon,authenticated,service_role;

-- Cryptographic binding/concurrency fields are server-managed. RLS remains an
-- independent tenant boundary for all remaining columns.
revoke select (encryption_record_id,security_revision),
       insert (encryption_record_id,security_revision),
       update (encryption_record_id,security_revision)
on public.businesses from anon,authenticated;

do $$ declare t text; begin
  foreach t in array array[
    'appointments','call_logs','flow_executions','integrations','requests',
    'people_docs','contracts','custom_voices','scenarios','jobs',
    'scenario_events','payments','invoices','staff','bugs'
  ] loop
    execute format('revoke select(security_revision),insert(security_revision),update(security_revision) on public.%I from anon,authenticated',t);
  end loop;
end $$;

-- Scenario-event authorization now uses the trusted column rather than
-- inspecting content which is intentionally ciphertext. Existing Phase 2/3
-- policies call these helpers and immediately inherit the corrected binding.
create or replace function nodemere_private.resource_role(j jsonb,t text)
returns text language sql stable security definer set search_path='' as $$
 select nodemere_private.member_role(b.id::text) from public.businesses b where
  case when t='businesses' then b.id::text=j->>'id'
       when t='scenario_events' then b.id::text=j->>'business_id'
       when j->>'business_id' is not null then b.id::text=j->>'business_id'
       else b.user_id::text=j->>'user_id' end limit 1
$$;
create or replace function nodemere_private.row_access(row_data jsonb,table_name text)
returns boolean language sql stable security definer set search_path='' as $$
 select case
  when table_name='users' then row_data->>'id'=auth.uid()::text and nodemere_private.account_active(auth.uid())
  when table_name='account_data_requests' then row_data->>'user_id'=auth.uid()::text and nodemere_private.account_active(auth.uid())
  when table_name='businesses' then nodemere_private.tenant_access(row_data->>'id',null)
    or (row_data->>'user_id'=auth.uid()::text and nodemere_private.account_active(auth.uid())
      and not exists(select 1 from public.businesses b where b.id::text=row_data->>'id')
      and not exists(select 1 from public.business_memberships m where m.user_id=auth.uid() and m.status='active'))
  when table_name='scenario_events' then nodemere_private.tenant_access(row_data->>'business_id',null)
  else nodemere_private.tenant_access(row_data->>'business_id',row_data->>'user_id') end
$$;

notify pgrst,'reload schema';
commit;
