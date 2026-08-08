-- Sonar plan entitlements.
-- Stripe remains the source of truth for prices, products, subscriptions, and checkout.
-- This table is the source of truth for what each plan includes in the application.

create table if not exists public.sonar_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  stripe_product_name text not null unique,
  sort_order integer not null default 0,
  is_public boolean not null default true,
  is_recommended boolean not null default false,
  display jsonb not null default '{}'::jsonb,
  entitlements jsonb not null default '{}'::jsonb,
  features jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sonar_plans_display_object check (jsonb_typeof(display) = 'object'),
  constraint sonar_plans_entitlements_object check (jsonb_typeof(entitlements) = 'object'),
  constraint sonar_plans_features_array check (jsonb_typeof(features) = 'array')
);

create index if not exists sonar_plans_public_sort_idx
  on public.sonar_plans (is_public, sort_order);

alter table public.sonar_plans enable row level security;

drop policy if exists "Public can read public Sonar plans" on public.sonar_plans;
create policy "Public can read public Sonar plans"
  on public.sonar_plans for select
  using (is_public = true);

insert into public.sonar_plans (
  slug,
  name,
  stripe_product_name,
  sort_order,
  is_public,
  is_recommended,
  display,
  entitlements,
  features
)
values
(
  'free',
  'Free',
  'Free',
  1,
  true,
  false,
  '{"description":"For testing the product with light usage.","cta":"Get started"}'::jsonb,
  '{"included_call_minutes":20,"max_receptionists":1,"max_scenarios":3,"max_contacts":100,"inbound_calling":true,"outbound_calling":false,"sms":false,"overage_enabled":false}'::jsonb,
  '["20 call minutes","1 receptionist","100 contacts","3 scenarios","Inbound calling"]'::jsonb
),
(
  'essentials',
  'Essentials',
  'Essentials',
  2,
  true,
  false,
  '{"description":"For businesses that need a solid front desk without the complexity.","cta":"Try for 14 days"}'::jsonb,
  '{"included_call_minutes":300,"max_receptionists":3,"max_scenarios":null,"max_contacts":1000,"inbound_calling":true,"outbound_calling":false,"sms":false,"overage_enabled":true,"overage_price_per_minute_cents":30}'::jsonb,
  '["300 call minutes","3 receptionists","1,000 contacts","Unlimited scenarios","Inbound calling"]'::jsonb
),
(
  'pro',
  'Pro',
  'Pro',
  3,
  true,
  true,
  '{"description":"For growing businesses that need serious call capacity.","cta":"Try for 14 days"}'::jsonb,
  '{"included_call_minutes":1500,"max_receptionists":null,"max_scenarios":null,"max_contacts":null,"inbound_calling":true,"outbound_calling":true,"sms":true,"overage_enabled":true,"overage_price_per_minute_cents":30}'::jsonb,
  '["1,500 call minutes","Unlimited receptionists","Unlimited contacts","Unlimited scenarios","Outbound calling","Inbound calling","Voice cloning","SMS support"]'::jsonb
),
(
  'ultra',
  'Ultra',
  'Ultra',
  4,
  true,
  false,
  '{"description":"For high-volume teams running advanced voice operations.","cta":"Try for 14 days"}'::jsonb,
  '{"included_call_minutes":3000,"max_receptionists":null,"max_scenarios":null,"max_contacts":null,"inbound_calling":true,"outbound_calling":true,"sms":true,"overage_enabled":true,"overage_price_per_minute_cents":30}'::jsonb,
  '["3,000 call minutes","Unlimited receptionists","Unlimited contacts","Unlimited scenarios","Inbound calling","Outbound calling","Voice cloning","SMS support","Dedicated onboarding specialist"]'::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  stripe_product_name = excluded.stripe_product_name,
  sort_order = excluded.sort_order,
  is_public = excluded.is_public,
  is_recommended = excluded.is_recommended,
  display = excluded.display,
  entitlements = excluded.entitlements,
  features = excluded.features,
  updated_at = now();

-- Keep updated_at accurate when an entitlement is edited in Supabase.
create or replace function public.set_sonar_plans_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sonar_plans_set_updated_at on public.sonar_plans;
create trigger sonar_plans_set_updated_at
before update on public.sonar_plans
for each row execute function public.set_sonar_plans_updated_at();

-- Backfill the allowance for businesses that already have a matching user plan.
update public.businesses as b
set current_cycle_included_seconds = coalesce((p.entitlements ->> 'included_call_minutes')::integer, 0) * 60
from public.users as u
join public.sonar_plans as p on p.slug = lower(coalesce(u.plan, 'free'))
where b.user_id = u.id;
