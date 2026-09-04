-- ONLY the disposable Phase 3 fixture database. No real identities or records.
\if :{?security_disposable}
\else
\quit
\endif
create schema storage;
create table storage.buckets(id text primary key,public boolean);
create table storage.objects(id uuid,bucket_id text,name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated,service_role;
grant all on all tables in schema storage to anon,authenticated,service_role;
create policy old_storage_allow_all on storage.objects for all using(true) with check(true);
insert into storage.buckets values('caller-documents',true),('call_recordings',true),('voice-contracts',true),('business-avatars',true);
create table auth.mfa_factors(user_id uuid,status text);
insert into public.call_logs(id,business_id,user_id,raw_payload,transcript_text) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'11111111-1111-4111-8111-111111111111','{"full_audio":"SYNTHETIC_PHI_CANARY"}','SYNTHETIC_PHI_CANARY'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,'22222222-2222-4222-8222-222222222222','{}','foreign');
\ir ../sql/2026_09_03_phase4_data_minimization.sql
\ir ../sql/2026_09_03_phase4_data_minimization.sql
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
select set_config('request.jwt.claims','{"aal":"aal2"}',false);
do $$ declare c text; begin
 assert (select count(id) from public.call_logs)=1,'owner permitted call metadata only own business';
 foreach c in array array['raw_payload','transcript_text','transcript_jsonb','audio_storage_path','analysis_results','conversation_initiation_data','call_report'] loop
  assert not has_column_privilege('authenticated','public.call_logs',c,'SELECT'),'call private column';
 end loop;
 assert not has_column_privilege('authenticated','public.invoices','raw_stripe_invoice','SELECT'),'invoice raw body denied';
 assert not has_table_privilege('authenticated','public.people_docs','SELECT'),'document access through API only';
 assert not has_table_privilege('authenticated','public.people_docs','INSERT'),'cannot forge document storage ownership';
 assert not has_table_privilege('authenticated','public.requests','SELECT'),'request token hashes server only';
 begin perform raw_payload from public.call_logs; raise exception 'raw payload leaked'; exception when insufficient_privilege then null; end;
 begin insert into storage.objects values(gen_random_uuid(),'business-avatars','fake.svg'); raise exception 'direct upload bypass'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"aal":"aal1"}',false);
do $$ begin assert (select count(id) from public.call_logs)=0,'MFA still guards permitted columns'; end $$;
reset role;
update businesses set workforce_mfa_required=false where id=1;
insert into auth.mfa_factors values('44444444-4444-4444-8444-444444444444','verified');
set role authenticated;
do $$ begin assert (select count(id) from people)=0,'optional verified factor still requires challenge'; end $$;
select set_config('request.jwt.claims','{"aal":"aal2"}',false);
do $$ begin assert (select count(id) from people)=1,'valid optional MFA works'; end $$;
reset role;
set role anon;
do $$ begin
 assert not has_any_column_privilege('anon','public.call_logs','SELECT'),'anonymous calls denied';
 assert not has_any_column_privilege('anon','public.payments','SELECT'),'anonymous payments remain blocked';
 assert not has_any_column_privilege('anon','public.flow_executions','SELECT'),'anonymous executions remain blocked';
end $$;
reset role;
set role service_role;
do $$ begin assert (select count(*) from public.call_logs)=2,'server access preserved'; end $$;
reset role;
do $$ begin
 assert not exists(select 1 from storage.buckets where id in ('caller-documents','call_recordings','voice-contracts') and public),'sensitive buckets private';
 assert (select public from storage.buckets where id='business-avatars'),'public marketing assets preserved';
end $$;
\echo 'PASS: Phase 4 column grants, private buckets, upload bypass, optional MFA, Phase 1 containment, server access, idempotence'
