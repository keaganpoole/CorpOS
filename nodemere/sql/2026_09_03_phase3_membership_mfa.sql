-- Requires Phases 1 and 2. No existing customer records are rewritten.
begin;
alter table public.businesses add column if not exists workforce_mfa_required boolean not null default false;
create table if not exists public.business_memberships (
 business_id bigint not null references public.businesses(id),
 user_id uuid not null references public.users(id),
 role text not null check(role in ('OWNER','MANAGER','STAFF')),
 status text not null default 'active' check(status in ('active','removed')),
 created_at timestamptz not null default now(),
 primary key(business_id,user_id)
);
-- Current product has one active workspace per login. Fail migration on
-- ambiguous existing ownership rather than silently choosing a business.
create unique index if not exists one_active_workforce_business on public.business_memberships(user_id) where status='active';
insert into public.business_memberships(business_id,user_id,role)
 select id,user_id,'OWNER' from public.businesses where user_id is not null
 on conflict(business_id,user_id) do nothing;
create table if not exists public.business_invitations (
 id uuid primary key default gen_random_uuid(),
 business_id bigint not null references public.businesses(id),
 email text not null,
 role text not null check(role in ('MANAGER','STAFF')),
 invited_by uuid not null references public.users(id),
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.business_memberships enable row level security;
alter table public.business_invitations enable row level security;
revoke all on public.business_memberships,public.business_invitations from public,anon,authenticated;
grant select,insert,update,delete on public.business_memberships,public.business_invitations to service_role;

create or replace function nodemere_private.has_mfa(actor uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare enrolled boolean;
begin
 if to_regclass('auth.mfa_factors') is null then return false; end if;
 execute 'select exists(select 1 from auth.mfa_factors where user_id=$1 and status=''verified'')' into enrolled using actor;
 return enrolled;
end $$;
create or replace function nodemere_private.member_role(business text)
returns text language sql stable security definer set search_path='' as $$
 select m.role from public.business_memberships m
 join public.businesses b on b.id=m.business_id
 where m.business_id::text=business and m.user_id=auth.uid() and m.status='active'
 and nodemere_private.account_active(m.user_id) and nodemere_private.account_active(b.user_id)
 and ((not b.workforce_mfa_required and not nodemere_private.has_mfa(m.user_id)) or auth.jwt()->>'aal'='aal2')
$$;
create or replace function nodemere_private.tenant_access(business text,owner_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.businesses b where
   (business is null or b.id::text=business) and (owner_id is null or b.user_id::text=owner_id)
   and (business is not null or owner_id is not null)
   and nodemere_private.member_role(b.id::text) is not null)
$$;
create or replace function nodemere_private.resource_role(j jsonb,t text)
returns text language sql stable security definer set search_path='' as $$
 select nodemere_private.member_role(b.id::text) from public.businesses b where
  case when t='businesses' then b.id::text=j->>'id'
       when t='scenario_events' then b.id::text=j#>>'{payload,business_id}'
       when j->>'business_id' is not null then b.id::text=j->>'business_id'
       else b.user_id::text=j->>'user_id' end limit 1
$$;
create or replace function nodemere_private.row_access(row_data jsonb,table_name text)
returns boolean language sql stable security definer set search_path='' as $$
 select case
  when table_name='users' then row_data->>'id'=auth.uid()::text and nodemere_private.account_active(auth.uid())
  when table_name='account_data_requests' then row_data->>'user_id'=auth.uid()::text and nodemere_private.account_active(auth.uid())
  when table_name='businesses' then nodemere_private.tenant_access(row_data->>'id',null)
    or (row_data->>'user_id'=auth.uid()::text and nodemere_private.account_active(auth.uid())
      and not exists(select 1 from public.businesses b where b.id::text=row_data->>'id')
      and not exists(select 1 from public.business_memberships m where m.user_id=auth.uid() and m.status='active'))
  when table_name='scenario_events' then nodemere_private.tenant_access(row_data#>>'{payload,business_id}',row_data#>>'{payload,user_id}')
  else nodemere_private.tenant_access(row_data->>'business_id',row_data->>'user_id') end
$$;

create or replace function nodemere_private.resource_permission(j jsonb,t text,op text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare r text:=nodemere_private.resource_role(j,t);
begin
 if t='businesses' and op='INSERT' then return nodemere_private.row_access(j,t); end if;
 if t in ('users','account_data_requests') then return nodemere_private.row_access(j,t); end if;
 if r is null then return false; end if;
 if op='SELECT' then
   if t in ('call_logs','people_docs','payments','invoices','billing_overage_events','reviews','purchased_numbers') then return r in ('OWNER','MANAGER'); end if;
   return true;
 end if;
 if op='DELETE' then return r='OWNER' and auth.jwt()->>'aal'='aal2'; end if;
 -- Browser writes use actual JSON arrays, not encoded JSON strings that could
 -- hide a privileged action from the policy and be decoded later by a worker.
 if t='scenarios' and jsonb_typeof(j->'nodes_data') not in ('array','null') then return false; end if;
 if t='scenarios' and coalesce(j->>'nodes_data','') ~ '(refund_payment|cancel_subscription)' then return r='OWNER' and auth.jwt()->>'aal'='aal2'; end if;
 if t in ('people','appointments') then return true; end if;
 if t in ('staff','services','scenarios','hired_receptionists','people_schema','appointments_schema') then return r in ('OWNER','MANAGER'); end if;
 return r='OWNER' and auth.jwt()->>'aal'='aal2';
end $$;

create or replace function nodemere_private.initial_owner()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.business_memberships(business_id,user_id,role) values(new.id,new.user_id,'OWNER') on conflict do nothing;
 return new;
end $$;
drop trigger if exists phase3_initial_owner on public.businesses;
create trigger phase3_initial_owner after insert on public.businesses for each row execute function nodemere_private.initial_owner();

create or replace function nodemere_private.last_owner_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.businesses where id=old.business_id for update;
 if old.status='active' and old.role='OWNER' and (tg_op='DELETE' or new.status<>'active' or new.role<>'OWNER')
 and not exists(select 1 from public.business_memberships where business_id=old.business_id and status='active' and role='OWNER' and user_id<>old.user_id) then
   raise exception 'Last active owner cannot be removed or demoted' using errcode='23514';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists phase3_last_owner on public.business_memberships;
create trigger phase3_last_owner before update or delete on public.business_memberships for each row execute function nodemere_private.last_owner_guard();

-- Atomic backend-only operations. Actor identity/email are obtained from
-- Supabase Auth by the API, never passed through from client JSON.
create or replace function public.nodemere_accept_invitation(invitation uuid,actor uuid,verified_email text)
returns bigint language plpgsql security definer set search_path='' as $$
declare i public.business_invitations;
begin
 select * into i from public.business_invitations where id=invitation for update;
 if i.id is null or i.expires_at<=now() or i.accepted_at is not null or i.revoked_at is not null
 or lower(i.email)<>lower(verified_email) or not nodemere_private.account_active(actor) then
   raise exception 'Invitation unavailable' using errcode='42501';
 end if;
 if not exists(select 1 from public.business_memberships m where m.business_id=i.business_id and m.user_id=i.invited_by and m.status='active' and m.role='OWNER') then
   raise exception 'Inviter no longer authorized' using errcode='42501';
 end if;
 insert into public.business_memberships(business_id,user_id,role,status) values(i.business_id,actor,i.role,'active')
 on conflict(business_id,user_id) do update set role=excluded.role,status='active'
 where business_memberships.status='removed';
 if not found then raise exception 'Already a member' using errcode='42501'; end if;
 update public.business_invitations set accepted_at=now() where id=i.id;
 return i.business_id;
end $$;
create or replace function public.nodemere_transfer_ownership(business bigint,actor uuid,target uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.businesses where id=business for update;
 if actor=target or not exists(select 1 from public.business_memberships where business_id=business and user_id=actor and role='OWNER' and status='active') then
  raise exception 'Owner required' using errcode='42501'; end if;
 update public.business_memberships set role='OWNER' where business_id=business and user_id=target and status='active';
 if not found or not nodemere_private.account_active(target) then raise exception 'Active member required' using errcode='42501'; end if;
 update public.business_memberships set role='MANAGER' where business_id=business and user_id=actor;
 -- businesses.user_id remains the stable data/billing principal. Transferring
 -- administration does not silently move Stripe accounts or rewrite historical rows.
end $$;

do $$ declare t text; op text; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename not in
 ('business_memberships','business_invitations','receptionist_catalog','sonar_plans','system_config') loop
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='phase2_tenant_guard') then continue; end if;
  foreach op in array array['SELECT','INSERT','UPDATE','DELETE'] loop
   execute format('drop policy if exists %I on public.%I','phase3_'||lower(op),t);
   if op='INSERT' then
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (nodemere_private.resource_permission(to_jsonb(%I),%L,%L))','phase3_insert',t,t,t,op);
   else
    execute format('create policy %I on public.%I as restrictive for %s to authenticated using (nodemere_private.resource_permission(to_jsonb(%I),%L,%L))','phase3_'||lower(op),t,op,t,t,op);
   end if;
  end loop;
  -- New membership-based permissive read grants combine with the independent
  -- Phase 2 boundary. Backend-only tables keep their Phase 1 denials/grants.
  execute format('drop policy if exists phase3_member_read on public.%I',t);
  execute format('create policy phase3_member_read on public.%I for select to authenticated using (nodemere_private.row_access(to_jsonb(%I),%L))',t,t,t);
 end loop;
end $$;
-- Safe operational writes through the existing direct Supabase screens.
do $$ declare t text; begin
 foreach t in array array['people','appointments','staff','services','scenarios','hired_receptionists','people_schema','appointments_schema','businesses','account_settings'] loop
  if to_regclass('public.'||t) is null then continue; end if;
  execute format('drop policy if exists phase3_member_write on public.%I',t);
  execute format('create policy phase3_member_write on public.%I for all to authenticated using(nodemere_private.row_access(to_jsonb(%I),%L)) with check(nodemere_private.row_access(to_jsonb(%I),%L))',t,t,t,t,t);
 end loop;
end $$;
-- Replace ONLY the Phase 1 owner-specific read guard with the member guard.
-- Anonymous denial and all direct payment write denials remain unchanged.
drop policy if exists phase1_payments_owner_guard on public.payments;
create policy phase1_payments_owner_guard on public.payments as restrictive for select to authenticated
 using (nodemere_private.row_access(to_jsonb(payments),'payments'));
revoke all on function public.nodemere_accept_invitation(uuid,uuid,text),public.nodemere_transfer_ownership(bigint,uuid,uuid) from public,anon,authenticated;
grant execute on function public.nodemere_accept_invitation(uuid,uuid,text),public.nodemere_transfer_ownership(bigint,uuid,uuid) to service_role;
revoke all on all functions in schema nodemere_private from public;
grant execute on function nodemere_private.member_role(text),nodemere_private.resource_role(jsonb,text),nodemere_private.resource_permission(jsonb,text,text) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
