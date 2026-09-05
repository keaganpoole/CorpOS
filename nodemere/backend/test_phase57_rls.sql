-- Only the isolated Phase 2 -> 3 -> 4 fixture, NEVER the live project.
\if :{?security_disposable}
\else
\quit
\endif
\ir ../sql/2026_09_04_phase5_audit.sql
\ir ../sql/2026_09_04_phase6_envelope.sql
\ir ../sql/2026_09_05_phase6_people_encryption.sql
\ir ../sql/2026_09_04_phase7_recovery_retention.sql
\ir ../sql/2026_09_04_phase5_audit.sql
\ir ../sql/2026_09_04_phase6_envelope.sql
\ir ../sql/2026_09_05_phase6_people_encryption.sql
\ir ../sql/2026_09_04_phase7_recovery_retention.sql

begin;
-- Match the live project's NOT NULL payload contract, missed by the old fixture.
update public.call_logs set raw_payload='{}'::jsonb where raw_payload is null;
alter table public.call_logs alter column raw_payload set not null;
alter table public.call_logs alter column raw_payload set default '{}'::jsonb;
do $$ declare role text; t text; begin
 foreach role in array array['anon','authenticated'] loop
  foreach t in array array['security_audit_events','business_data_keys','business_retention_policy'] loop
   if has_table_privilege(role,'public.'||t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Client privilege on %',t; end if;
  end loop;
  if has_function_privilege(role,'public.nodemere_append_audit(jsonb)','EXECUTE')
   or has_function_privilege(role,'public.nodemere_provision_data_key(jsonb)','EXECUTE')
   or has_function_privilege(role,'public.nodemere_rewrap_data_key(uuid,text,text,text,text)','EXECUTE')
   or has_function_privilege(role,'public.nodemere_rotate_data_key(jsonb,uuid)','EXECUTE')
   or has_function_privilege(role,'public.nodemere_retention_batch(bigint,boolean)','EXECUTE') then raise exception 'Client RPC privilege'; end if;
 end loop;
 if has_table_privilege('service_role','security_audit_events','INSERT,UPDATE,DELETE') then raise exception 'Mutable audit privileges'; end if;
 if has_table_privilege('service_role','business_data_keys','INSERT,UPDATE,DELETE') then raise exception 'Mutable keys'; end if;
end $$;
\echo PASS: 16 client table/RPC checks; 2 service mutation-denial checks

set role authenticated;
do $$ begin
 begin perform notes from public.people; raise exception 'Direct patient notes readable'; exception when insufficient_privilege then null; end;
 begin perform notes from public.appointments; raise exception 'Direct appointment notes readable'; exception when insufficient_privilege then null; end;
 if not has_column_privilege('authenticated','people','id','SELECT') or not has_column_privilege('authenticated','appointments','id','SELECT') then raise exception 'Realtime identity revoked'; end if;
end $$;
reset role;
\echo PASS: 4 direct-PHI denial/Realtime-identity checks

insert into flow_executions(id,business_id,user_id,status,completed_at,flow_context) values
 ('51000000-0000-4000-8000-000000000001',1,'11111111-1111-4111-8111-111111111111','completed',now()-interval '20 days','{"phi":"SYNTHETIC_PRIVATE_CANARY"}'),
 ('51000000-0000-4000-8000-000000000002',1,'11111111-1111-4111-8111-111111111111','paused',now()-interval '20 days','{"phi":"SYNTHETIC_PRIVATE_CANARY"}'),
 ('51000000-0000-4000-8000-000000000003',2,'22222222-2222-4222-8222-222222222222','completed',now()-interval '20 days','{"phi":"SYNTHETIC_PRIVATE_CANARY"}');
insert into call_logs(id,business_id,user_id,created_at,raw_payload,transcript_text) values
 ('52000000-0000-4000-8000-000000000001',1,'11111111-1111-4111-8111-111111111111',now()-interval '20 days','{"phi":"SYNTHETIC_PRIVATE_CANARY"}','canonical transcript');
do $$ declare n bigint; begin
 select count(*) into n from security_audit_events;
 begin
  insert into people(id,business_id,user_id,notes) values(9991,1,'11111111-1111-4111-8111-111111111111','SYNTHETIC_PRIVATE_CANARY');
  raise exception 'rollback_test';
 exception when raise_exception then null; end;
 if (select count(*) from security_audit_events)<>n then raise exception 'Audit outlived rolled back change'; end if;
 if exists(select 1 from security_audit_events e where to_jsonb(e)::text like '%SYNTHETIC_PRIVATE_CANARY%') then raise exception 'PHI copied into audit'; end if;
 begin update security_audit_events set outcome='failed'; raise exception 'Update allowed'; exception when insufficient_privilege then null; end;
 begin delete from security_audit_events; raise exception 'Delete allowed'; exception when insufficient_privilege then null; end;
 begin truncate security_audit_events; raise exception 'Truncate allowed'; exception when insufficient_privilege then null; end;
end $$;
\echo PASS: 5 audit redaction/atomicity/immutability checks

set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2"}',true);
select set_config('request.headers','{"x-nodemere-audit-actor":"22222222-2222-4222-8222-222222222222"}',true);
update people set id=id where id=1;
reset role;
do $$ begin
 if (select actor_id from security_audit_events where resource='people' and action='record.update' order by id desc limit 1)<>'44444444-4444-4444-8444-444444444444'::uuid then raise exception 'Spoofed audit header accepted'; end if;
end $$;
set role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.headers','{"x-nodemere-audit-actor":"11111111-1111-4111-8111-111111111111","x-nodemere-audit-kind":"workforce"}',true);
update people set id=id where id=1;
reset role;
do $$ begin
 if (select actor_id from security_audit_events where resource='people' and action='record.update' order by id desc limit 1)<>'11111111-1111-4111-8111-111111111111'::uuid then raise exception 'Server actor attribution missing'; end if;
end $$;
select set_config('request.jwt.claims','{}',true);
select set_config('request.headers','{}',true);
\echo PASS: 2 trusted-actor attribution checks

set role service_role;
do $$ declare result jsonb; begin
 begin perform nodemere_append_audit('{"phi":"SYNTHETIC_PRIVATE_CANARY"}'); raise exception 'Unknown audit field allowed'; exception when invalid_parameter_value then null; end;
 result:=nodemere_retention_batch(1,true);
 if (result->>'applied')::boolean then raise exception 'Unconfigured retention applied'; end if;
end $$;
insert into business_retention_policy(business_id,enabled,workflow_days,transient_call_days) values(1,true,10,10);
do $$ declare result jsonb; begin
 result:=nodemere_retention_batch(1,false);
 if result->>'execution_count'<>'1' or result->>'call_count'<>'1' or result->>'applied'<>'false' then raise exception 'Wrong preview'; end if;
 if (select flow_context from flow_executions where id='51000000-0000-4000-8000-000000000001') is null then raise exception 'Preview mutated'; end if;
 update business_retention_policy set legal_hold=true where business_id=1;
 result:=nodemere_retention_batch(1,true);
 if result->>'blocked'<>'true' then raise exception 'Legal hold ignored'; end if;
 update business_retention_policy set legal_hold=false where business_id=1;
 result:=nodemere_retention_batch(1,true);
 if result->>'applied'<>'true' then raise exception 'Retention did not apply'; end if;
 if (select flow_context from flow_executions where id='51000000-0000-4000-8000-000000000001') is not null then raise exception 'Terminal payload retained'; end if;
 if (select flow_context from flow_executions where id='51000000-0000-4000-8000-000000000002') is null then raise exception 'Paused state destroyed'; end if;
 if (select flow_context from flow_executions where id='51000000-0000-4000-8000-000000000003') is null then raise exception 'Cross tenant retention'; end if;
 if (select transcript_text from call_logs where id='52000000-0000-4000-8000-000000000001')<>'canonical transcript' then raise exception 'Canonical transcript destroyed'; end if;
 result:=nodemere_retention_batch(1,true);
 if result->>'execution_count'<>'0' or result->>'call_count'<>'0' then raise exception 'Retention not idempotent'; end if;
end $$;
\echo PASS: 11 retention/default/preview/hold/isolation/resume/canonical/idempotence checks

do $$ declare candidate jsonb; winner jsonb; result jsonb; begin
 candidate:=jsonb_build_object('id','53000000-0000-4000-8000-000000000001','business_id',1,'kek_id','synthetic',
  'nonce',encode(decode(repeat('00',12),'hex'),'base64'),'wrapped_key',encode(decode(repeat('00',48),'hex'),'base64'));
 winner:=nodemere_provision_data_key(candidate);
 candidate:=jsonb_set(candidate,'{id}','"53000000-0000-4000-8000-000000000002"');
 result:=nodemere_provision_data_key(candidate);
 if result->>'id'<>winner->>'id' then raise exception 'Race replaced key'; end if;
 if not nodemere_rewrap_data_key((winner->>'id')::uuid,winner->>'wrapped_key','synthetic2',winner->>'nonce',winner->>'wrapped_key') then raise exception 'Rewrap failed'; end if;
 result:=nodemere_rotate_data_key(candidate,(winner->>'id')::uuid);
 if (select count(*) from business_data_keys where business_id=1)<>2 then raise exception 'Historical key discarded'; end if;
 begin
  update call_logs set transcript_text='plaintext downgrade' where id='52000000-0000-4000-8000-000000000001';
  raise exception 'Plaintext downgrade allowed';
 exception when insufficient_privilege then null; end;
 begin
  update call_logs set audio_storage_path='private/plain.mp3' where id='52000000-0000-4000-8000-000000000001';
  raise exception 'Plaintext recording path accepted';
 exception when insufficient_privilege then
  if sqlerrm<>'Protected file requires encryption' then raise; end if;
 end;
 update call_logs set is_favorited=true where id='52000000-0000-4000-8000-000000000001';
 if (select security_revision from call_logs where id='52000000-0000-4000-8000-000000000001')<>2 then raise exception 'Revision incorrect'; end if;
end $$;
reset role;
\echo PASS: 6 key creation/rewrap/rotation/plaintext payload/file downgrade/concurrency checks
rollback;
