-- Monthly Audition creations are independent of saved or hired receptionists.
update public.plans set entitlements = jsonb_set(entitlements, '{max_audition_creations_per_month}',
  to_jsonb(case slug when 'essentials' then 5 when 'pro' then 15 when 'ultra' then 15 else 2 end), true)
where slug in ('free', 'essentials', 'pro', 'ultra');

update public.plans set features = features || '["Create a receptionist"]'::jsonb
where slug in ('free', 'essentials', 'pro', 'ultra')
  and not (features @> '["Create a receptionist"]'::jsonb);

create table if not exists public.audition_creation_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id bigint not null references public.businesses(id) on delete cascade,
  design_candidate_id text not null,
  month_start date not null,
  state text not null default 'reserved' check (state in ('reserved', 'completed')),
  created_at timestamptz not null default now(),
  unique (user_id, business_id, design_candidate_id)
);
create index if not exists audition_creation_usage_month_idx
  on public.audition_creation_usage (user_id, month_start);
alter table public.audition_creation_usage enable row level security;
revoke all on public.audition_creation_usage from anon, authenticated;
grant select, insert, update, delete on public.audition_creation_usage to service_role;
grant usage, select on sequence public.audition_creation_usage_id_seq to service_role;

create or replace function public.nodemere_reserve_audition_creation(
  target_owner uuid, target_business bigint, candidate_id text
) returns integer language plpgsql security invoker set search_path = public as $$
declare
  current_month date := (date_trunc('month', now() at time zone 'UTC'))::date;
  plan_slug text;
  monthly_limit integer;
  used integer;
begin
  if candidate_id is null or length(candidate_id) = 0 or length(candidate_id) > 255 then
    raise exception 'invalid_audition_candidate';
  end if;
  -- Serialize all reservations for this owner, including requests with different candidates.
  perform pg_advisory_xact_lock(hashtextextended(target_owner::text, 20261101));
  if not exists (select 1 from public.businesses where id = target_business and user_id = target_owner) then
    raise exception 'audition_business_not_found';
  end if;
  select lower(coalesce(plan, 'free')) into plan_slug from public.users where id = target_owner;
  monthly_limit := case plan_slug when 'essentials' then 5 when 'pro' then 15 when 'ultra' then 15 else 2 end;
  select count(*) into used from public.audition_creation_usage
    where user_id = target_owner and month_start = current_month;
  if exists (select 1 from public.audition_creation_usage
             where user_id = target_owner and business_id = target_business and design_candidate_id = candidate_id) then
    return -1;
  end if;
  if used >= monthly_limit then raise exception 'audition_creation_limit_reached'; end if;
  insert into public.audition_creation_usage (user_id, business_id, design_candidate_id, month_start)
    values (target_owner, target_business, candidate_id, current_month);
  return used + 1;
end $$;

create or replace function public.nodemere_finish_audition_creation(
  target_owner uuid, target_business bigint, candidate_id text, completed boolean
) returns void language plpgsql security invoker set search_path = public as $$
begin
  if completed then
    update public.audition_creation_usage set state = 'completed'
      where user_id = target_owner and business_id = target_business and design_candidate_id = candidate_id;
  else
    delete from public.audition_creation_usage
      where user_id = target_owner and business_id = target_business and design_candidate_id = candidate_id and state = 'reserved';
  end if;
end $$;

revoke all on function public.nodemere_reserve_audition_creation(uuid,bigint,text) from public, anon, authenticated;
revoke all on function public.nodemere_finish_audition_creation(uuid,bigint,text,boolean) from public, anon, authenticated;
grant execute on function public.nodemere_reserve_audition_creation(uuid,bigint,text) to service_role;
grant execute on function public.nodemere_finish_audition_creation(uuid,bigint,text,boolean) to service_role;
