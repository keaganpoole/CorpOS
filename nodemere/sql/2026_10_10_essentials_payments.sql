-- Enable payment processing for every paid plan and expose it in the public
-- pricing feature list. Free remains the only plan without payment access.

update public.plans
set entitlements = coalesce(entitlements, '{}'::jsonb) || '{"payment_processing":true}'::jsonb,
    features = case
      when coalesce(features, '[]'::jsonb) @> '["Accept payments"]'::jsonb
        or coalesce(features, '[]'::jsonb) @> '["Take Payments"]'::jsonb then coalesce(features, '[]'::jsonb)
      else coalesce(features, '[]'::jsonb) || '["Accept payments"]'::jsonb
    end
where slug in ('essentials', 'pro', 'ultra');

update public.plans
set entitlements = coalesce(entitlements, '{}'::jsonb) || '{"payment_processing":false}'::jsonb
where slug = 'free';
