begin;

update public.plans
set entitlements = jsonb_set(
      entitlements,
      '{included_call_minutes}',
      to_jsonb(case slug
        when 'essentials' then 200
        when 'pro' then 1000
        when 'ultra' then 2500
      end),
      true
    ),
    features = jsonb_set(
      features,
      '{0}',
      to_jsonb(case slug
        when 'essentials' then '200 call minutes'
        when 'pro' then '1,000 call minutes'
        when 'ultra' then '2,500 call minutes'
      end),
      false
    ),
    updated_at = now()
where slug in ('essentials', 'pro', 'ultra');

-- Keep existing billing-cycle summaries aligned while preserving usage and dates.
update public.businesses as b
set current_cycle_included_seconds =
      (p.entitlements ->> 'included_call_minutes')::bigint * 60
from public.users as u
join public.plans as p on p.slug = lower(coalesce(u.plan, 'free'))
where b.user_id = u.id
  and p.slug in ('essentials', 'pro', 'ultra');

commit;
