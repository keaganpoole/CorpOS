-- Additive. Apply before enabling NODEMERE_AUDIT_MODE=enforced.
begin;
create table if not exists public.security_audit_events (
 id bigint generated always as identity primary key,
 occurred_at timestamptz not null default clock_timestamp(),
 business_id bigint,
 actor_id uuid,
 actor_type text not null check(actor_type in ('workforce','service','anonymous','database')),
 action text not null check(action ~ '^[a-z0-9_.]{1,80}$'),
 resource text not null check(resource ~ '^[A-Za-z0-9_./{}:-]{1,160}$'),
 record_ids jsonb not null default '[]' check(jsonb_typeof(record_ids)='array' and jsonb_array_length(record_ids)<=200),
 outcome text not null check(outcome in ('started','succeeded','denied','failed')),
 request_id uuid,
 -- Only machine status and column NAMES. Never row values or provider bodies.
 status_code integer,
 changed_columns text[] not null default '{}'
);
create index if not exists security_audit_business_time on public.security_audit_events(business_id,id desc);
alter table public.security_audit_events enable row level security;
revoke all on public.security_audit_events from public,anon,authenticated,service_role;
revoke all on sequence public.security_audit_events_id_seq from public,anon,authenticated,service_role;
grant select on public.security_audit_events to service_role;
create or replace function nodemere_private.audit_immutable() returns trigger
language plpgsql set search_path='' as $$ begin
 raise exception 'Security audit records are append-only' using errcode='42501'; end $$;
drop trigger if exists phase5_audit_immutable on public.security_audit_events;
create trigger phase5_audit_immutable before update or delete or truncate on public.security_audit_events
for each statement execute function nodemere_private.audit_immutable();

create or replace function public.nodemere_append_audit(event jsonb) returns bigint
language plpgsql security definer set search_path='' as $$
declare result bigint; ids jsonb; item jsonb;
begin
 if event - array['business_id','actor_id','actor_type','action','resource','record_ids','outcome','request_id','status_code'] <> '{}'::jsonb then
  raise exception 'Unsupported audit field' using errcode='22023'; end if;
 ids:=coalesce(event->'record_ids','[]'::jsonb);
 if jsonb_typeof(ids)<>'array' or jsonb_array_length(ids)>200 then raise exception 'Invalid record IDs'; end if;
 for item in select value from jsonb_array_elements(ids) loop
  if jsonb_typeof(item)<>'string' or not (item #>> '{}') ~ '^([0-9]{1,20}|[0-9a-fA-F-]{36})$' then raise exception 'Invalid record ID'; end if;
 end loop;
 insert into public.security_audit_events(business_id,actor_id,actor_type,action,resource,record_ids,outcome,request_id,status_code)
 values ((event->>'business_id')::bigint,(event->>'actor_id')::uuid,event->>'actor_type',event->>'action',
 event->>'resource',ids,event->>'outcome',(event->>'request_id')::uuid,(event->>'status_code')::integer)
 returning id into result;
 return result;
end $$;
revoke all on function public.nodemere_append_audit(jsonb) from public,anon,authenticated;
grant execute on function public.nodemere_append_audit(jsonb) to service_role;

create or replace function nodemere_private.audit_row_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_data jsonb; previous jsonb; business bigint; actor uuid; columns_changed text[];
 headers jsonb; actor_kind text; correlation uuid;
begin
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 previous:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 business:=nullif(row_data->>'business_id','')::bigint;
 if tg_table_name='businesses' then business:=(row_data->>'id')::bigint; end if;
 if business is null and row_data->>'user_id' is not null then
  select b.id into business from public.businesses b where b.user_id=(row_data->>'user_id')::uuid limit 1;
 end if;
 actor:=auth.uid();
 actor_kind:=case when actor is null then 'database' else 'workforce' end;
 -- Only the server's signed service-role identity may supply an audit actor.
 -- Headers sent with an ordinary user's JWT cannot spoof attribution.
 if coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role'='service_role' then
  headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  if headers->>'x-nodemere-audit-actor' ~ '^[0-9a-fA-F-]{36}$' then
   actor:=(headers->>'x-nodemere-audit-actor')::uuid;
   actor_kind:=case when headers->>'x-nodemere-audit-kind'='workforce' then 'workforce' else 'service' end;
  end if;
  if headers->>'x-nodemere-audit-request' ~ '^([0-9a-fA-F]{32}|[0-9a-fA-F-]{36})$' then
   correlation:=(headers->>'x-nodemere-audit-request')::uuid;
  end if;
 end if;
 select coalesce(array_agg(key order by key),'{}') into columns_changed from jsonb_each(row_data)
 where tg_op<>'UPDATE' or value is distinct from previous->key;
 insert into public.security_audit_events(business_id,actor_id,actor_type,action,resource,record_ids,outcome,changed_columns,request_id)
 values(business,actor,actor_kind,
 'record.'||lower(tg_op),tg_table_name,
 case when coalesce(row_data->>'id',row_data->>'user_id') is null then '[]'::jsonb
 else jsonb_build_array(coalesce(row_data->>'id',row_data->>'user_id')) end,'succeeded',columns_changed,correlation);
 if tg_op='DELETE' then return old; end if; return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['businesses','business_memberships','business_invitations','people','appointments',
 'staff','services','call_logs','people_docs','scenarios','integrations','payments','invoices',
 'hired_receptionists','account_settings','account_data_requests','users','requests','contracts'] loop
  if to_regclass('public.'||t) is null then continue; end if;
  execute format('drop trigger if exists phase5_audit_change on public.%I',t);
  execute format('create trigger phase5_audit_change after insert or update or delete on public.%I for each row execute function nodemere_private.audit_row_change()',t);
 end loop;
end $$;
revoke all on function nodemere_private.audit_immutable(),nodemere_private.audit_row_change() from public,anon,authenticated,service_role;
-- PHI reads go through the audited API. Keep only invalidation metadata for
-- existing Realtime subscriptions; RLS remains an independent tenant boundary.
do $$ declare t text; c text; begin
 foreach t in array array['people','appointments'] loop
  execute format('revoke select on public.%I from public,anon,authenticated',t);
  for c in select column_name from information_schema.columns where table_schema='public' and table_name=t loop
   execute format('revoke select (%I) on public.%I from public,anon,authenticated',c,t);
  end loop;
  execute format('grant select (id,business_id,created_at,updated_at,status) on public.%I to authenticated',t);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
