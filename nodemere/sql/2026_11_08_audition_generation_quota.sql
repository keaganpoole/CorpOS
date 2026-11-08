create or replace function public.nodemere_claim_audition_generation(
  target_owner uuid, target_business bigint, generation_id text, candidate_id text
) returns integer language plpgsql security invoker set search_path = public as $$
declare
  current_month date := (date_trunc('month', now() at time zone 'UTC'))::date;
  plan_slug text;
  monthly_limit integer;
  used integer;
  claimed integer;
begin
  if generation_id is null or length(generation_id) = 0 or length(generation_id) > 255
     or candidate_id is null or length(candidate_id) = 0 or length(candidate_id) > 255 then
    raise exception 'invalid_audition_candidate';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_owner::text, 20261101));
  if not exists (select 1 from public.businesses where id = target_business and user_id = target_owner) then
    raise exception 'audition_business_not_found';
  end if;
  if exists (select 1 from public.audition_creation_usage
             where user_id = target_owner and business_id = target_business
               and design_candidate_id = candidate_id) then
    return -1;
  end if;
  update public.audition_creation_usage
    set design_candidate_id = candidate_id
    where user_id = target_owner and business_id = target_business
      and design_candidate_id = 'generation:' || generation_id
      and month_start = current_month and state = 'completed';
  get diagnostics claimed = row_count;
  if claimed = 1 then return 1; end if;

  select lower(coalesce(plan, 'free')) into plan_slug from public.users where id = target_owner;
  monthly_limit := case plan_slug when 'essentials' then 5 when 'pro' then 15 when 'ultra' then 15 else 2 end;
  select count(*) into used from public.audition_creation_usage
    where user_id = target_owner and month_start = current_month;
  if used >= monthly_limit then raise exception 'audition_creation_limit_reached'; end if;
  insert into public.audition_creation_usage (user_id, business_id, design_candidate_id, month_start)
    values (target_owner, target_business, candidate_id, current_month);
  return used + 1;
end $$;

revoke all on function public.nodemere_claim_audition_generation(uuid,bigint,text,text) from public, anon, authenticated;
grant execute on function public.nodemere_claim_audition_generation(uuid,bigint,text,text) to service_role;