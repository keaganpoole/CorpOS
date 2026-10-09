-- Destructive operational reset. Keeps Auth, billing, and security/legal history.
begin;

create or replace function nodemere_private.last_owner_guard()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if coalesce(current_setting('nodemere.account_reset', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if old.status='active' and old.role='OWNER'
     and (tg_op='DELETE' or new.status<>'active' or new.role<>'OWNER')
     and not exists(
       select 1 from public.business_memberships
       where business_id=old.business_id and status='active' and role='OWNER' and user_id<>old.user_id
     ) then
    raise exception 'Last active owner cannot be removed or demoted';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.nodemere_reset_account(target_user uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_business_id bigint;
  v_table_name text;
begin
  if target_user is null then
    raise exception 'A target user is required' using errcode='22023';
  end if;

  select b.id into v_business_id
  from public.businesses b
  where b.user_id = target_user
  order by b.id
  limit 1
  for update;

  if v_business_id is not null and exists (
    select 1 from public.business_memberships m
    where m.business_id = v_business_id and m.status = 'active' and m.user_id <> target_user
  ) then
    raise exception 'Remove other active team members before resetting this account' using errcode='23514';
  end if;

  perform set_config('nodemere.account_reset', 'on', true);

  if to_regclass('public.business_invitations') is not null and v_business_id is not null then
    delete from public.business_invitations where business_id = v_business_id;
  end if;

  if v_business_id is not null then
    foreach v_table_name in array array[
      'business_data_keys','business_retention_policy','voice_clone_consents',
      'people_field_definitions','verification_sessions','people_docs','requests','contracts','drop_ins','flow_executions','jobs',
      'scenario_events','call_logs','appointments','nest','intercom','intercom_usage_daily',
      'reviews','bugs','custom_voices','people_schema','appointments_schema','account_settings',
      'created_receptionists','hired_receptionists','scenarios','staff','services','people','purchased_numbers'
    ] loop
      if to_regclass('public.' || v_table_name) is not null
         and exists (
           select 1 from information_schema.columns c
           where c.table_schema='public' and c.table_name=v_table_name and c.column_name='business_id'
         ) then
        execute format('delete from public.%I where business_id = $1', v_table_name) using v_business_id;
      end if;
    end loop;

    delete from public.business_memberships where business_id = v_business_id;
    delete from public.businesses where id = v_business_id and user_id = target_user;
  end if;

  if to_regclass('public.integrations') is not null then
    delete from public.integrations where user_id = target_user;
  end if;

  update public.users
  set onboarded = false,
      phone = null,
      popups = '{}'::jsonb,
      tasklist = '{}'::jsonb,
      account_status = 'active',
      closed_at = null,
      deletion_requested_at = null
  where id = target_user;

  return jsonb_build_object('reset', true, 'billing_preserved', true, 'user_id', target_user);
end;
$$;

revoke all on function public.nodemere_reset_account(uuid) from public, anon, authenticated;
grant execute on function public.nodemere_reset_account(uuid) to service_role;

commit;
