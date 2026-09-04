-- Additive key registry. NEVER contains unwrapped DEKs or KEKs.
begin;
create table if not exists public.business_data_keys (
 id uuid primary key,
 business_id bigint not null references public.businesses(id),
 kek_id text not null check(kek_id ~ '^[a-zA-Z0-9_-]{1,64}$'),
 nonce text not null check(octet_length(decode(nonce,'base64'))=12),
 wrapped_key text not null check(octet_length(decode(wrapped_key,'base64'))=48),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 rewrapped_at timestamptz
);
create unique index if not exists business_data_keys_one_active on public.business_data_keys(business_id) where active;
alter table public.business_data_keys enable row level security;
revoke all on public.business_data_keys from public,anon,authenticated,service_role;
grant select on public.business_data_keys to service_role;

create or replace function public.nodemere_provision_data_key(candidate jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare business bigint:=(candidate->>'business_id')::bigint; result jsonb;
begin
 -- Serialize first creation; a race must return the winning wrapped DEK.
 perform pg_advisory_xact_lock(hashtextextended('nodemere.keys.'||business::text,61006));
 select to_jsonb(k) into result from public.business_data_keys k where business_id=business and active;
 if result is not null then return result; end if;
 if exists(select 1 from public.business_data_keys where business_id=business) then
  raise exception 'Key recovery is required'; end if;
 insert into public.business_data_keys(id,business_id,kek_id,nonce,wrapped_key)
 values((candidate->>'id')::uuid,business,candidate->>'kek_id',candidate->>'nonce',candidate->>'wrapped_key')
 returning to_jsonb(business_data_keys.*) into result;
 perform public.nodemere_append_audit(jsonb_build_object('business_id',business,'actor_type','service',
  'action','key.created','resource','business_data_keys','record_ids',jsonb_build_array(candidate->>'id'),'outcome','succeeded'));
 return result;
end $$;
create or replace function public.nodemere_rewrap_data_key(key_id uuid,previous_wrapper text,new_kek_id text,new_nonce text,new_wrapper text) returns boolean
language plpgsql security definer set search_path='' as $$
declare business bigint;
begin
 update public.business_data_keys set kek_id=new_kek_id,nonce=new_nonce,wrapped_key=new_wrapper,rewrapped_at=now()
 where id=key_id and wrapped_key=previous_wrapper returning business_id into business;
 if business is null then raise exception 'Key changed; reload before retry'; end if;
 perform public.nodemere_append_audit(jsonb_build_object('business_id',business,'actor_type','service',
  'action','key.rewrapped','resource','business_data_keys','record_ids',jsonb_build_array(key_id::text),'outcome','succeeded'));
 return true;
end $$;
revoke all on function public.nodemere_provision_data_key(jsonb),public.nodemere_rewrap_data_key(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.nodemere_provision_data_key(jsonb),public.nodemere_rewrap_data_key(uuid,text,text,text,text) to service_role;
-- Optimistic concurrency for encrypted read/modify/write, never blind overwrite.
do $$ declare t text; begin
 foreach t in array array['call_logs','flow_executions','integrations'] loop
  execute format('alter table public.%I add column if not exists security_revision bigint not null default 0',t);
 end loop;
end $$;
create or replace function nodemere_private.bump_security_revision() returns trigger
language plpgsql set search_path='' as $$ begin new.security_revision:=old.security_revision+1; return new; end $$;
do $$ declare t text; begin
 foreach t in array array['call_logs','flow_executions','integrations'] loop
  execute format('drop trigger if exists phase6_security_revision on public.%I',t);
  execute format('create trigger phase6_security_revision before update on public.%I for each row execute function nodemere_private.bump_security_revision()',t);
 end loop;
end $$;
revoke all on function nodemere_private.bump_security_revision() from public,anon,authenticated,service_role;
create or replace function nodemere_private.guard_encrypted_payload() returns trigger
language plpgsql security definer set search_path='' as $$
declare business bigint; fields text[]; f text; value jsonb; row_data jsonb:=to_jsonb(new); old_data jsonb;
begin
 old_data:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 if tg_table_name='integrations' then
  select id into business from public.businesses where user_id=new.user_id;
  fields:=array['credentials'];
 elsif tg_table_name='call_logs' then
  business:=new.business_id;
  fields:=array['transcript_jsonb','transcript_text','call_report','analysis_results','conversation_initiation_data'];
 else
  business:=new.business_id; fields:=array['flow_context','pause_data','trigger_event'];
 end if;
 if not exists(select 1 from public.business_data_keys where business_id=business) then return new; end if;
 foreach f in array fields loop
  value:=row_data->f;
  if value is null or value='null'::jsonb or (tg_op='UPDATE' and value is not distinct from old_data->f) then continue; end if;
  if not (jsonb_typeof(value)='object' and value ? '_nodemere_envelope') and not
   (jsonb_typeof(value)='string' and (value #>> '{}') like 'ndmenc:v1:%') then
   raise exception 'Protected payload requires encryption' using errcode='42501';
  end if;
 end loop;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['call_logs','flow_executions','integrations'] loop
  execute format('drop trigger if exists phase6_require_encryption on public.%I',t);
  execute format('create trigger phase6_require_encryption before insert or update on public.%I for each row execute function nodemere_private.guard_encrypted_payload()',t);
 end loop;
end $$;
revoke all on function nodemere_private.guard_encrypted_payload() from public,anon,authenticated,service_role;
-- Deliberate DEK rotation retains every historical wrapper for old records and backups.
create or replace function public.nodemere_rotate_data_key(candidate jsonb, expected_active uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare business bigint:=(candidate->>'business_id')::bigint; result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('nodemere.keys.'||business::text,61006));
 update public.business_data_keys set active=false where id=expected_active and business_id=business and active;
 if not found then raise exception 'Active key changed; reload before rotation'; end if;
 insert into public.business_data_keys(id,business_id,kek_id,nonce,wrapped_key)
 values((candidate->>'id')::uuid,business,candidate->>'kek_id',candidate->>'nonce',candidate->>'wrapped_key') returning to_jsonb(business_data_keys.*) into result;
 perform public.nodemere_append_audit(jsonb_build_object('business_id',business,'actor_type','service',
  'action','key.rotated','resource','business_data_keys','record_ids',jsonb_build_array(candidate->>'id'),'outcome','succeeded'));
 return result;
end $$;
revoke all on function public.nodemere_rotate_data_key(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.nodemere_rotate_data_key(jsonb,uuid) to service_role;
create or replace function nodemere_private.guard_encrypted_file() returns trigger
language plpgsql security definer set search_path='' as $$
declare file_path text; previous_path text;
begin
 if tg_table_name='people_docs' then
  file_path:=new.storage_path;
  if tg_op='UPDATE' then previous_path:=old.storage_path; end if;
 else
  file_path:=new.audio_storage_path;
  if tg_op='UPDATE' then previous_path:=old.audio_storage_path; end if;
 end if;
 if file_path is null or (tg_op='UPDATE' and file_path is not distinct from previous_path) then return new; end if;
 if exists(select 1 from public.business_data_keys where business_id=new.business_id) and right(file_path,7)<>'.ndmenc' then
  raise exception 'Protected file requires encryption' using errcode='42501'; end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['people_docs','call_logs'] loop
  execute format('drop trigger if exists phase6_require_encrypted_file on public.%I',t);
  execute format('create trigger phase6_require_encrypted_file before insert or update on public.%I for each row execute function nodemere_private.guard_encrypted_file()',t);
 end loop;
end $$;
revoke all on function nodemere_private.guard_encrypted_file() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
