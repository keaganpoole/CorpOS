-- Add server-owned ceilings for usage-based call overage.
-- The backend also carries defaults so the gate remains fail-safe if a plan row
-- has not been migrated yet; run this migration against existing environments.
update public.plans
set entitlements = entitlements || '{"overage_cap_cents":2500}'::jsonb
where slug = 'essentials';

update public.plans
set entitlements = entitlements || '{"overage_cap_cents":10000}'::jsonb
where slug = 'pro';

update public.plans
set entitlements = entitlements || '{"overage_cap_cents":25000}'::jsonb
where slug = 'ultra';
