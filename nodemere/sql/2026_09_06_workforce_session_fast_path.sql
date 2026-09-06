-- Collapse dashboard authorization bootstrap into one server-only database call.
begin;

drop function if exists public.nodemere_workforce_session(uuid);

create or replace function public.nodemere_workforce_session(target_actor uuid)
returns table (
  actor_exists boolean,
  actor_status text,
  active_membership_count bigint,
  business_id bigint,
  owner_id uuid,
  membership_role text,
  owner_exists boolean,
  owner_status text,
  workforce_mfa_required boolean,
  mfa_enrolled boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with active_memberships as (
    select m.business_id, m.role, b.user_id as owner_id, b.workforce_mfa_required
    from public.business_memberships m
    left join public.businesses b on b.id = m.business_id
    where m.user_id = target_actor and m.status = 'active'
  ), selected as (
    select * from active_memberships order by business_id limit 1
  )
  select
    exists(select 1 from public.users u where u.id = target_actor),
    (select u.account_status from public.users u where u.id = target_actor),
    (select count(*) from active_memberships),
    selected.business_id,
    selected.owner_id,
    selected.role,
    exists(select 1 from public.users u where u.id = selected.owner_id),
    (select u.account_status from public.users u where u.id = selected.owner_id),
    coalesce(selected.workforce_mfa_required, false),
    nodemere_private.has_mfa(target_actor)
  from (values (1)) as singleton(value)
  left join selected on true;
$$;

revoke all on function public.nodemere_workforce_session(uuid) from public, anon, authenticated;
grant execute on function public.nodemere_workforce_session(uuid) to service_role;

commit;
