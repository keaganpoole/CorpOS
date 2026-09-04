-- Run only in the disposable Phase 2 fixture database.
\if :{?security_disposable}
\else
\quit
\endif
\ir ../sql/2026_09_03_phase3_membership_mfa.sql
\ir ../sql/2026_09_03_phase3_membership_mfa.sql
insert into users(id,email,account_status) values
 ('44444444-4444-4444-8444-444444444444','staff@example.test','active'),
 ('55555555-5555-4555-8555-555555555555','manager@example.test','active'),
 ('66666666-6666-4666-8666-666666666666','invite@example.test','active'),
 ('77777777-7777-4777-8777-777777777777','new@example.test','active');
insert into business_memberships(business_id,user_id,role) values
 (1,'44444444-4444-4444-8444-444444444444','STAFF'),
 (1,'55555555-5555-4555-8555-555555555555','MANAGER');
insert into payments(id,user_id,business_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',1),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',2);
insert into business_invitations(id,business_id,email,role,invited_by) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',1,'invite@example.test','STAFF','11111111-1111-4111-8111-111111111111'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',1,'invite@example.test','MANAGER','11111111-1111-4111-8111-111111111111');
update business_invitations set expires_at=now()-interval '1 day' where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$ begin
 assert (select role from business_memberships where business_id=1 and user_id='11111111-1111-4111-8111-111111111111')='OWNER','existing creator owner';
 begin delete from business_memberships where business_id=1 and role='OWNER'; raise exception 'last owner removal accepted'; exception when check_violation then null; end;
 begin update business_memberships set role='STAFF' where business_id=1 and role='OWNER'; raise exception 'last owner demotion accepted'; exception when check_violation then null; end;
 begin perform nodemere_accept_invitation('cccccccc-cccc-4ccc-8ccc-cccccccccccc','66666666-6666-4666-8666-666666666666','wrong@example.test'); raise exception 'email mismatch accepted'; exception when insufficient_privilege then null; end;
 begin perform nodemere_accept_invitation('dddddddd-dddd-4ddd-8ddd-dddddddddddd','66666666-6666-4666-8666-666666666666','invite@example.test'); raise exception 'expired accepted'; exception when insufficient_privilege then null; end;
 perform nodemere_accept_invitation('cccccccc-cccc-4ccc-8ccc-cccccccccccc','66666666-6666-4666-8666-666666666666','invite@example.test');
 begin perform nodemere_accept_invitation('cccccccc-cccc-4ccc-8ccc-cccccccccccc','66666666-6666-4666-8666-666666666666','invite@example.test'); raise exception 'reuse accepted'; exception when insufficient_privilege then null; end;
 assert (select role from business_memberships where user_id='66666666-6666-4666-8666-666666666666')='STAFF','server invitation role';
end $$;
set role authenticated;
select set_config('request.jwt.claims','{"aal":"aal1"}',false);
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
do $$ begin
 assert (select count(*) from people)=1,'staff own people read';
 assert (select count(*) from payments)=0,'staff payment denied';
 update people set first_name='Front desk' where id=1;
 assert (select first_name from people where id=1)='Front desk','staff legitimate update';
 assert not nodemere_private.resource_permission('{"business_id":1}','staff','UPDATE'),'staff cannot manage staff';
 begin update business_memberships set role='OWNER' where user_id=auth.uid(); raise exception 'self promotion'; exception when insufficient_privilege then null; end;
 assert not has_function_privilege('authenticated','public.nodemere_accept_invitation(uuid,uuid,text)','execute'),'browser acceptance RPC';
 assert not has_function_privilege('authenticated','public.nodemere_transfer_ownership(bigint,uuid,uuid)','execute'),'browser transfer RPC';
end $$;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false);
do $$ begin
 assert (select count(*) from payments)=1,'manager owner payments only';
 assert nodemere_private.resource_permission('{"business_id":1}','staff','UPDATE'),'manager staff update';
 assert not nodemere_private.resource_permission('{"id":1}','businesses','UPDATE'),'manager owner-only denied';
 assert not nodemere_private.resource_permission('{"business_id":1,"nodes_data":[{"actionConfig":{"_key":" refund_payment "}}]}','scenarios','UPDATE'),'padded privileged action denied';
 assert not nodemere_private.resource_permission(jsonb_build_object('business_id',1,'nodes_data','[{"subOptionKey":"\u0072efund_payment"}]'::text),'scenarios','UPDATE'),'encoded privileged action denied';
 assert nodemere_private.resource_permission('{"business_id":1,"nodes_data":[{"subOptionKey":"create_appointment"}]}','scenarios','UPDATE'),'manager normal workflow allowed';
end $$;
reset role;
update businesses set workforce_mfa_required=true where id=1;
set role authenticated;
do $$ begin assert (select count(*) from people)=0,'MFA missing direct database denied'; end $$;
select set_config('request.jwt.claims','{"aal":"aal2"}',false);
do $$ begin assert (select count(*) from people)=1,'MFA verified direct database allowed'; end $$;
reset role;
update business_memberships set status='removed' where user_id='55555555-5555-4555-8555-555555555555';
set role authenticated;
do $$ begin assert (select count(*) from people)=0,'removed member with old AAL2 session denied'; end $$;
reset role;
select nodemere_transfer_ownership(1,'11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444');
do $$ begin
 assert (select role from business_memberships where user_id='44444444-4444-4444-8444-444444444444')='OWNER','new owner';
 assert (select role from business_memberships where user_id='11111111-1111-4111-8111-111111111111')='MANAGER','former owner';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',false);
insert into businesses(id,user_id) values(7,auth.uid());
reset role;
do $$ begin assert (select role from business_memberships where business_id=7)='OWNER','new creator owner'; end $$;
\echo 'PASS: Phase 3 roles, invitations, ownership, removal, MFA and direct database bypass regression'
