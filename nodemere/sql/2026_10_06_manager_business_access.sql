-- Managers may run the business, but cannot access billing, delete the
-- business, or gain ownership through a member-management action.
begin;

create or replace function nodemere_private.resource_permission(j jsonb,t text,op text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare r text:=nodemere_private.resource_role(j,t);
begin
 if t='businesses' and op='INSERT' then return nodemere_private.row_access(j,t); end if;
 if t in ('users','account_data_requests') then return nodemere_private.row_access(j,t); end if;
 if r is null then return false; end if;
 if t in ('payments','invoices','billing_overage_events') then
   if op='SELECT' then return r='OWNER'; end if;
   return r='OWNER' and auth.jwt()->>'aal'='aal2';
 end if;
 if op='SELECT' then
   if t in ('call_logs','people_docs','reviews','purchased_numbers') then return r in ('OWNER','MANAGER'); end if;
   return true;
 end if;
 if t='businesses' and op='DELETE' then return r='OWNER' and auth.jwt()->>'aal'='aal2'; end if;
 if op='DELETE' then return r in ('OWNER','MANAGER'); end if;
 if t='scenarios' and jsonb_typeof(j->'nodes_data') not in ('array','null') then return false; end if;
 if t='scenarios' and coalesce(j->>'nodes_data','') ~ '(refund_payment|cancel_subscription)' then
   return r='OWNER' and auth.jwt()->>'aal'='aal2';
 end if;
 if t in ('people','appointments') then return true; end if;
 return r in ('OWNER','MANAGER');
end $$;

-- An active manager's invitation remains valid through acceptance. The
-- caller's identity and verified email are supplied by the backend only.
create or replace function public.nodemere_accept_invitation(invitation uuid,actor uuid,verified_email text)
returns bigint language plpgsql security definer set search_path='' as $$
declare i public.business_invitations;
begin
 select * into i from public.business_invitations where id=invitation for update;
 if i.id is null or i.expires_at<=now() or i.accepted_at is not null or i.revoked_at is not null
 or lower(i.email)<>lower(verified_email) or not nodemere_private.account_active(actor) then
   raise exception 'Invitation unavailable' using errcode='42501';
 end if;
 if not exists(select 1 from public.business_memberships m
   where m.business_id=i.business_id and m.user_id=i.invited_by
   and m.status='active' and m.role in ('OWNER','MANAGER')) then
   raise exception 'Inviter no longer authorized' using errcode='42501';
 end if;
 insert into public.business_memberships(business_id,user_id,role,status) values(i.business_id,actor,i.role,'active')
 on conflict(business_id,user_id) do update set role=excluded.role,status='active'
 where business_memberships.status='removed';
 if not found then raise exception 'Already a member' using errcode='42501'; end if;
 update public.business_invitations set accepted_at=now() where id=i.id;
 return i.business_id;
end $$;

revoke all on function public.nodemere_accept_invitation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.nodemere_accept_invitation(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
