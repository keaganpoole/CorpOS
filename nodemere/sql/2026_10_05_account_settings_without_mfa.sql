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
 if t='account_settings' then return r in ('OWNER','MANAGER'); end if;
 if op='DELETE' then return r='OWNER' and auth.jwt()->>'aal'='aal2'; end if;
 if t='scenarios' and jsonb_typeof(j->'nodes_data') not in ('array','null') then return false; end if;
 if t='scenarios' and coalesce(j->>'nodes_data','') ~ '(refund_payment|cancel_subscription)' then return r='OWNER' and auth.jwt()->>'aal'='aal2'; end if;
 if t in ('people','appointments') then return true; end if;
 if t in ('staff','services','scenarios','hired_receptionists','people_schema','appointments_schema') then return r in ('OWNER','MANAGER'); end if;
 return r='OWNER' and auth.jwt()->>'aal'='aal2';
end $$;

notify pgrst,'reload schema';
