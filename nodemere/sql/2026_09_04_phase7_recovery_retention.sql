-- No scheduled jobs and no changes to existing data. All policies default OFF.
begin;
create table if not exists public.business_retention_policy (
 business_id bigint primary key references public.businesses(id),
 enabled boolean not null default false,
 legal_hold boolean not null default false,
 workflow_days integer check(workflow_days between 1 and 3650),
 transient_call_days integer check(transient_call_days between 1 and 3650),
 updated_at timestamptz not null default now()
);
alter table public.business_retention_policy enable row level security;
revoke all on public.business_retention_policy from public,anon,authenticated;
grant select,insert,update on public.business_retention_policy to service_role;
drop trigger if exists phase5_audit_change on public.business_retention_policy;
create trigger phase5_audit_change after insert or update on public.business_retention_policy
for each row execute function nodemere_private.audit_row_change();

create or replace function public.nodemere_retention_batch(target_business bigint, apply_changes boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy public.business_retention_policy; executions uuid[]; calls uuid[]; result jsonb;
begin
 -- Policy lock prevents a concurrent hold/change from racing this batch.
 select * into policy from public.business_retention_policy where business_id=target_business for update;
 if not found or not policy.enabled or policy.legal_hold then
  return jsonb_build_object('blocked',true,'execution_count',0,'call_count',0,'applied',false); end if;
 -- Lock selected rows: a paused/resumed execution cannot race payload removal.
 select coalesce(array_agg(id),'{}') into executions from (
  select id from public.flow_executions where business_id=target_business and status in ('completed','failed')
  and coalesce(completed_at,failed_at) < now()-make_interval(days=>policy.workflow_days)
  and (flow_context is not null or pause_data is not null or trigger_event is not null or error is not null)
  order by id limit 100 for update skip locked) x;
 select coalesce(array_agg(id),'{}') into calls from (
  select id from public.call_logs where business_id=target_business
  and created_at < now()-make_interval(days=>policy.transient_call_days)
  and (coalesce(raw_payload,'{}'::jsonb)<>'{}'::jsonb or conversation_initiation_data is not null or analysis_results is not null)
  order by id limit 100 for update skip locked) x;
 if apply_changes then
  update public.flow_executions set flow_context=null,pause_data=null,trigger_event=null,error=null
  where id=any(executions) and business_id=target_business;
  -- Existing Supabase schema requires raw_payload NOT NULL; an empty object
  -- clears the duplicated content and must not become a perpetual candidate.
  update public.call_logs set raw_payload='{}'::jsonb,conversation_initiation_data=null,analysis_results=null
  where id=any(calls) and business_id=target_business;
  perform public.nodemere_append_audit(jsonb_build_object('business_id',target_business,'actor_type','service',
   'action','retention.applied','resource','flow_executions','record_ids',to_jsonb(executions),'outcome','succeeded'));
  perform public.nodemere_append_audit(jsonb_build_object('business_id',target_business,'actor_type','service',
   'action','retention.applied','resource','call_logs','record_ids',to_jsonb(calls),'outcome','succeeded'));
 end if;
 return jsonb_build_object('blocked',false,'execution_count',cardinality(executions),'call_count',cardinality(calls),'applied',apply_changes);
end $$;
revoke all on function public.nodemere_retention_batch(bigint,boolean) from public,anon,authenticated;
grant execute on function public.nodemere_retention_batch(bigint,boolean) to service_role;
notify pgrst,'reload schema';
commit;
