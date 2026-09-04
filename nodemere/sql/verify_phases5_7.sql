-- READ ONLY. Catalog verification is necessary, not a live acceptance substitute.
select
 (select bool_and(relrowsecurity) from pg_class where oid in
  ('public.security_audit_events'::regclass,'public.business_data_keys'::regclass,'public.business_retention_policy'::regclass)) as new_tables_rls_enabled,
 not has_table_privilege('authenticated','public.security_audit_events','SELECT,INSERT,UPDATE,DELETE') as client_audit_blocked,
 not has_table_privilege('service_role','public.security_audit_events','INSERT,UPDATE,DELETE') as server_cannot_rewrite_audit,
 not has_table_privilege('authenticated','public.business_data_keys','SELECT,INSERT,UPDATE,DELETE') as client_keys_blocked,
 not has_table_privilege('service_role','public.business_data_keys','INSERT,UPDATE,DELETE') as server_cannot_directly_mutate_keys,
 not has_column_privilege('authenticated','public.people','notes','SELECT') as direct_people_phi_blocked,
 not has_column_privilege('authenticated','public.appointments','notes','SELECT') as direct_appointment_phi_blocked,
 has_column_privilege('authenticated','public.people','id','SELECT') as realtime_identity_preserved,
 not has_function_privilege('authenticated','public.nodemere_provision_data_key(jsonb)','EXECUTE') as client_key_rpc_blocked,
 not has_function_privilege('anon','public.nodemere_retention_batch(bigint,boolean)','EXECUTE') as anon_retention_blocked,
 not has_function_privilege('authenticated','public.nodemere_retention_batch(bigint,boolean)','EXECUTE') as client_retention_blocked,
 has_function_privilege('service_role','public.nodemere_retention_batch(bigint,boolean)','EXECUTE') as maintenance_retention_preserved;

select count(*) filter(where enabled) as enabled_retention_policies,
 count(*) filter(where legal_hold) as businesses_on_hold from public.business_retention_policy;
