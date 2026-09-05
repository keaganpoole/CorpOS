-- Apply after Phase 1. Additive/idempotent; no customer rows are deleted.
begin;
create schema if not exists nodemere_private;
revoke all on schema nodemere_private from public;
grant usage on schema nodemere_private to authenticated, anon, service_role;

create or replace function nodemere_private.account_active(actor uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.users u where u.id=actor
   and coalesce(u.account_status,'active') not in ('closed','pending_deletion','disabled'))
$$;
create or replace function nodemere_private.tenant_access(business text, owner_id text)
returns boolean language sql stable security definer set search_path = '' as $$
 select nodemere_private.account_active(auth.uid()) and (
   (business is not null and exists(select 1 from public.businesses b
      where b.id::text=business and b.user_id=auth.uid()
      and (owner_id is null or owner_id=b.user_id::text)))
   or (business is null and owner_id=auth.uid()::text))
$$;
create or replace function nodemere_private.row_access(row_data jsonb, table_name text)
returns boolean language sql stable security definer set search_path = '' as $$
 select case
   when table_name='users' then row_data->>'id'=auth.uid()::text and nodemere_private.account_active(auth.uid())
   when table_name='account_data_requests' then row_data->>'user_id'=auth.uid()::text and nodemere_private.account_active(auth.uid())
   when table_name='businesses' then row_data->>'user_id'=auth.uid()::text and nodemere_private.account_active(auth.uid())
   when table_name='scenario_events' then nodemere_private.tenant_access(row_data#>>'{payload,business_id}',row_data#>>'{payload,user_id}')
   else nodemere_private.tenant_access(row_data->>'business_id',row_data->>'user_id') end
$$;

create or replace function nodemere_private.protect_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare j jsonb:=to_jsonb(new); prev jsonb; k text; ref_table text; ref_row jsonb;
begin
 -- Constraints apply to browser writes; the trusted backend has explicit checks.
 if current_setting('role',true) not in ('anon','authenticated') then return new; end if;
 if tg_op='UPDATE' then
   prev:=to_jsonb(old);
   foreach k in array array['id','business_id','user_id','created_by','account_status',
    'stripe_customer_id','stripe_payment_method_id','stripe_subscription_id','subscription_status',
    'plan','stripe','billing_period','terms_of_service','closed_at','deletion_requested_at','onboarded',
    'trial_start_date','trial_end_date','started_trial','months_subscribed','card_retries','latest_charge_attempt',
    'forwarding_config','current_cycle_started_at','current_cycle_ends_at',
    'current_cycle_used_seconds','current_cycle_overage_seconds','current_cycle_included_seconds'] loop
     if j->k is distinct from prev->k then raise exception 'Server-managed field' using errcode='42501'; end if;
   end loop;
 end if;
 if tg_op='INSERT' and tg_table_name='businesses' then
   foreach k in array array['forwarding_config','current_cycle_started_at','current_cycle_ends_at',
     'current_cycle_used_seconds','current_cycle_overage_seconds','current_cycle_included_seconds'] loop
     if j->k is not null and j->k not in ('null'::jsonb,'0'::jsonb,'{}'::jsonb) then
       raise exception 'Server-managed initial field' using errcode='42501';
     end if;
   end loop;
 end if;
 if not nodemere_private.row_access(j,tg_table_name) then
   raise exception 'Tenant access denied' using errcode='42501';
 end if;
 for k,ref_table in select * from (values
  ('person_id','people'),('appointment_id','appointments'),('staff_id','staff'),('service_id','services'),
  ('receptionist_id','hired_receptionists'),('hired_receptionist_id','hired_receptionists'),
  ('scenario_id','scenarios'),('payment_id','payments'),('invoice_id','invoices'),
  ('request_id','requests'),('contract_id','contracts'),('assigned_staff','staff')) m(k,t) loop
   if nullif(j->>k,'') is not null and to_regclass('public.'||ref_table) is not null then
     execute format('select to_jsonb(r) from public.%I r where id::text=$1',ref_table) into ref_row using j->>k;
     if ref_row is null or not nodemere_private.row_access(ref_row,ref_table)
       or (j->>'business_id' is not null and ref_row->>'business_id' is not null and j->>'business_id'<>ref_row->>'business_id') then
       raise exception 'Invalid tenant reference' using errcode='42501';
     end if;
   end if;
 end loop;
 return new;
end $$;

do $$ declare t text; begin
 foreach t in array array['businesses','users','people','appointments','staff','services','call_logs',
  'hired_receptionists','scenarios','flow_executions','people_docs','people_schema','appointments_schema',
  'requests','contracts','custom_voices','jobs','purchased_numbers','account_settings','nest','bugs','reviews',
  'billing_overage_events','payments','invoices','integrations','checkpoints','scenario_events','account_data_requests'] loop
  if to_regclass('public.'||t) is null then continue; end if;
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists phase2_tenant_guard on public.%I',t);
  execute format('create policy phase2_tenant_guard on public.%I as restrictive for all to anon,authenticated using (nodemere_private.row_access(to_jsonb(%I),%L)) with check (nodemere_private.row_access(to_jsonb(%I),%L))',t,t,t,t,t);
  execute format('drop trigger if exists phase2_protect_row on public.%I',t);
  execute format('create trigger phase2_protect_row before insert or update on public.%I for each row execute function nodemere_private.protect_row()',t);
 end loop;
end $$;
-- No direct browser writes to raw event/credential/provider tables. Keep read
-- paths available only where independent tenant RLS permits them.
do $$ declare t text; cols text; begin
 foreach t in array array['call_logs','payments','invoices','people_docs','requests','contracts','custom_voices','jobs',
  'purchased_numbers','nest','billing_overage_events','checkpoints','scenario_events'] loop
  if to_regclass('public.'||t) is null then continue; end if;
  execute format('revoke insert,update,delete,truncate,references,trigger on public.%I from public,anon,authenticated',t);
  select string_agg(quote_ident(attname),',') into cols from pg_attribute where attrelid=to_regclass('public.'||t) and attnum>0 and not attisdropped;
  execute format('revoke insert(%1$s),update(%1$s),references(%1$s) on public.%2$I from public,anon,authenticated',cols,t);
 end loop;
end $$;
revoke insert,delete on public.users from public,anon,authenticated;
-- No current Nodemere frontend calls application RPCs. Custom public functions
-- (including SECURITY DEFINER workers) are backend-only. Extension functions
-- and auth.uid()/auth.jwt() are untouched; trigger invocation still works.
do $$ declare f record; t text; cols text; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f'
  and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') loop
  execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
 foreach t in array array['plans','receptionist_catalog','system_config'] loop
  if to_regclass('public.'||t) is null then continue; end if;
  execute format('revoke insert,update,delete,truncate on public.%I from public,anon,authenticated',t);
  select string_agg(quote_ident(attname),',') into cols from pg_attribute where attrelid=to_regclass('public.'||t) and attnum>0 and not attisdropped;
  execute format('revoke insert(%s),update(%s) on public.%I from public,anon,authenticated',cols,cols,t);
 end loop;
end $$;

-- Storage write guards use the same live account/business checks. The existing
-- two avatar buckets remain public assets; caller documents remain private.
do $$ begin
 if to_regclass('storage.objects') is not null then
  execute 'drop policy if exists phase2_storage_guard on storage.objects';
  execute $p$create policy phase2_storage_guard on storage.objects as restrictive for all to anon,authenticated
    using (bucket_id in ('business-avatars','staff-avatars') and
      nodemere_private.tenant_access(split_part(name,'/',2),split_part(name,'/',1)))
    with check (bucket_id in ('business-avatars','staff-avatars') and
      nodemere_private.tenant_access(split_part(name,'/',2),split_part(name,'/',1)))$p$;
 end if;
end $$;
revoke all on all functions in schema nodemere_private from public;
grant execute on function nodemere_private.account_active(uuid),nodemere_private.tenant_access(text,text),nodemere_private.row_access(jsonb,text) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
