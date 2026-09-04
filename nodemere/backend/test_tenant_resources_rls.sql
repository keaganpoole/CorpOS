-- Run ONLY after test_phase2_rls.sql, test_phase3_rls.sql and test_phase4_rls.sql
-- in the disposable local fixture. Synthetic rows roll back at the end.
\if :{?security_disposable}
\else
\quit
\endif
begin;
create temporary table security_resources(table_name text,id_a text,id_b text,can_write boolean);
grant select on security_resources to authenticated,service_role;
do $$ declare t text; id_type text; a text; b text; begin
 foreach t in array array['people','appointments','staff','services','call_logs','hired_receptionists',
  'scenarios','flow_executions','people_docs','people_schema','appointments_schema','requests','contracts',
  'custom_voices','jobs','purchased_numbers','account_settings','nest','bugs','reviews','billing_overage_events',
  'payments','invoices','integrations','checkpoints','scenario_events'] loop
  select atttypid::regtype::text into id_type from pg_attribute where attrelid=('public.'||t)::regclass and attname='id';
  a:=case when id_type='uuid' then 'aaaaaaaa-0000-4000-8000-000000000901' else '901' end;
  b:=case when id_type='uuid' then 'bbbbbbbb-0000-4000-8000-000000000902' else '902' end;
  execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1)',t,t)
   using jsonb_build_object('id',a,'business_id',1,'security_revision',0,'user_id','11111111-1111-4111-8111-111111111111',
    'payload',jsonb_build_object('business_id',1,'user_id','11111111-1111-4111-8111-111111111111'));
  execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1)',t,t)
   using jsonb_build_object('id',b,'business_id',2,'security_revision',0,'user_id','22222222-2222-4222-8222-222222222222',
    'payload',jsonb_build_object('business_id',2,'user_id','22222222-2222-4222-8222-222222222222'));
  insert into security_resources values(t,a,b,t=any(array['people','appointments','staff','services',
    'hired_receptionists','scenarios','people_schema','appointments_schema','account_settings','bugs','reviews']));
 end loop;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
do $$ declare r record; n int; has_id boolean; begin
 for r in select * from security_resources loop
  has_id:=has_column_privilege('authenticated','public.'||r.table_name,'id','SELECT');
  if has_id then
   execute format('select count(id) from public.%I where id::text=$1',r.table_name) into n using r.id_b;
   assert n=0, 'Cross-tenant SELECT: '||r.table_name;
   execute format('select count(id) from public.%I where id::text=$1',r.table_name) into n using r.id_a;
   assert n=1, 'Owner legitimate SELECT: '||r.table_name;
  else
   begin
    execute format('select id from public.%I limit 1',r.table_name);
    raise exception 'Server-only SELECT allowed: %',r.table_name;
   exception when insufficient_privilege then null; end;
  end if;
  if r.can_write then
   -- Even a harmless write to a known foreign ID must affect zero rows.
   execute format('update public.%I set id=id where id::text=$1',r.table_name) using r.id_b;
   get diagnostics n=row_count;
   assert n=0, 'Cross-tenant UPDATE: '||r.table_name;
   execute format('delete from public.%I where id::text=$1',r.table_name) using r.id_b;
   get diagnostics n=row_count;
   assert n=0, 'Cross-tenant DELETE: '||r.table_name;
   execute format('update public.%I set id=id where id::text=$1',r.table_name) using r.id_a;
   get diagnostics n=row_count;
   assert n=1, 'Owner legitimate UPDATE: '||r.table_name;
   begin
    execute format('update public.%I set business_id=2 where id::text=$1',r.table_name) using r.id_a;
    raise exception 'Ownership movement accepted: %',r.table_name;
   exception when insufficient_privilege then null; end;
  else
   assert not has_table_privilege('authenticated','public.'||r.table_name,'UPDATE'), 'Client UPDATE grant: '||r.table_name;
  end if;
 end loop;
 -- A valid own appointment cannot refer to another business's valid IDs.
 begin update appointments set person_id=902 where id='aaaaaaaa-0000-4000-8000-000000000901';
  raise exception 'Foreign person accepted'; exception when insufficient_privilege then null; end;
 begin update appointments set staff_id='bbbbbbbb-0000-4000-8000-000000000902' where id='aaaaaaaa-0000-4000-8000-000000000901';
  raise exception 'Foreign staff accepted'; exception when insufficient_privilege then null; end;
 begin update appointments set service_id='bbbbbbbb-0000-4000-8000-000000000902' where id='aaaaaaaa-0000-4000-8000-000000000901';
  raise exception 'Foreign service accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
do $$ declare r record; n int; begin
 for r in select * from security_resources loop
  execute format('select count(id) from public.%I where id::text in ($1,$2)',r.table_name) into n using r.id_a,r.id_b;
  assert n=2,'Server access preserved: '||r.table_name;
 end loop;
end $$;
reset role;
rollback;
\echo 'PASS: 26-resource direct database isolation, server-only grants, ownership/reference attacks, authorized operations, server access'
