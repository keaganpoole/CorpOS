-- READ ONLY. Run in the Supabase SQL editor AFTER applying Phases 2, 3 and 4.
-- These catalog checks do not replace signed-in owner/member/nonmember tests.
select
  not has_any_column_privilege('anon','public.payments','SELECT,INSERT,UPDATE') as anonymous_payments_blocked,
  not has_any_column_privilege('anon','public.flow_executions','SELECT,INSERT,UPDATE') as anonymous_executions_blocked,
  not has_any_column_privilege('authenticated','public.integrations','SELECT,INSERT,UPDATE') as client_integration_credentials_blocked,
  not has_table_privilege('authenticated','public.business_memberships','INSERT,UPDATE,DELETE') as client_membership_changes_blocked,
  not has_table_privilege('authenticated','public.business_invitations','SELECT,INSERT,UPDATE,DELETE') as direct_invitations_blocked,
  not has_column_privilege('authenticated','public.call_logs','raw_payload','SELECT') as client_raw_calls_blocked,
  not has_column_privilege('authenticated','public.call_logs','transcript_jsonb','SELECT') as client_transcripts_blocked,
  not has_column_privilege('authenticated','public.call_logs','audio_storage_path','SELECT') as client_recording_paths_blocked,
  has_column_privilege('authenticated','public.call_logs','id','SELECT') as authorized_call_metadata_granted,
  not has_column_privilege('authenticated','public.invoices','raw_stripe_invoice','SELECT') as raw_invoice_payloads_blocked,
  not has_table_privilege('authenticated','public.people_docs','SELECT,INSERT,UPDATE,DELETE') as documents_api_only,
  not has_function_privilege('authenticated','public.nodemere_accept_invitation(uuid,uuid,text)','EXECUTE') as direct_invitation_rpc_blocked,
  not has_function_privilege('authenticated','public.nodemere_transfer_ownership(bigint,uuid,uuid)','EXECUTE') as direct_transfer_rpc_blocked,
  has_function_privilege('service_role','public.nodemere_accept_invitation(uuid,uuid,text)','EXECUTE') as server_invitation_rpc_preserved;

select c.relname,c.relrowsecurity,
 exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname and p.policyname='phase2_tenant_guard') as tenant_guard,
 exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname and p.policyname='phase3_select') as role_guard
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname=any(array[
 'businesses','users','people','appointments','staff','services','call_logs','hired_receptionists',
 'scenarios','flow_executions','people_docs','people_schema','appointments_schema','requests','contracts',
 'custom_voices','jobs','purchased_numbers','account_settings','nest','bugs','reviews','billing_overage_events',
 'payments','invoices','integrations','checkpoints','scenario_events','account_data_requests'])
order by c.relname;

select id,public from storage.buckets
where id in ('caller-documents','call_recordings','voice-contracts');

-- These should show restrictive INSERT/UPDATE/DELETE policies with false checks.
select policyname,permissive,roles,cmd,qual,with_check from pg_policies
where schemaname='storage' and tablename='objects' and policyname like 'phase4_storage_%'
order by policyname;

-- Counts only: no names, emails, customer rows, credentials or factor secrets.
select
 (select count(*) from public.businesses b where b.user_id is not null and not exists
   (select 1 from public.business_memberships m where m.business_id=b.id and m.role='OWNER' and m.status='active')) as businesses_without_active_owner,
 (select count(*) from public.businesses where workforce_mfa_required) as businesses_requiring_mfa;
