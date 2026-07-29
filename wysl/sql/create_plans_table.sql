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
  4,
  true,
  false,
  '{"description":"Try Sonar risk-free","cta":"Choose plan"}'::jsonb,
  '{"included_call_minutes":30,"max_receptionists":1,"max_scenarios":2,"max_contacts":100,"inbound_calling":true,"outbound_calling":false,"texting":false,"overage_enabled":false}'::jsonb,
  '[{"label":"30 included call minutes","description":"Use up to thirty minutes of AI call time during each billing cycle."},{"label":"1 AI Receptionist","description":"Try one receptionist before upgrading."},{"label":"2 Scenarios","description":"Build up to two basic workflows."},{"label":"Store 100 Contacts","description":"Keep up to one hundred contacts in your CRM."},{"label":"24/7 AI Inbound Call Handling","description":"Answer incoming calls with your AI receptionist."}]'::jsonb
),
(
  'essentials',
  'Essentials',
  'Essentials',
  3,
  true,
  false,
  '{"description":"Launch a fully operational AI receptionist that answers calls, books appointments, and handles customers 24/7","cta":"Try for 14 days"}'::jsonb,
  '{"included_call_minutes":300,"max_receptionists":3,"max_scenarios":10,"max_contacts":1000,"inbound_calling":true,"outbound_calling":false,"texting":false,"overage_enabled":false}'::jsonb,
  '[{"label":"300 included call minutes","description":"Use up to three hundred minutes of AI call time during each billing cycle."},{"label":"3 AI Receptionists","description":"Use up to three receptionists for different call styles or duties."},{"label":"24/7 AI Inbound Call Handling","description":"Answer incoming calls around the clock without missing opportunities."},{"label":"10 Scenarios","description":"Build up to ten workflows for calls, appointments, records, and more."},{"label":"Appointment Booking","description":"Book, update, and manage appointments during live conversations."},{"label":"Store 1,000 Contacts","description":"Keep up to one thousand contacts in your CRM."},{"label":"Live Call Monitoring","description":"Watch live call activity and follow what your system is doing."},{"label":"Call Analytics","description":"See summaries and performance data from your calls."}]'::jsonb
),
(
  'pro',
  'Pro',
  'Pro',
  2,
  true,
  true,
  '{"description":"Advanced AI receptionist infrastructure designed to operate beyond the limitations of traditional staffing","cta":"Try for 14 days"}'::jsonb,
  '{"included_call_minutes":1500,"max_receptionists":25,"max_scenarios":null,"max_contacts":null,"inbound_calling":true,"outbound_calling":true,"texting":true,"overage_enabled":false}'::jsonb,
  '[{"label":"1,500 included call minutes","description":"Use up to one thousand five hundred minutes of AI call time during each billing cycle."},{"label":"Everything in Essentials","description":"Starts with all Essentials features already included."},{"label":"25 Receptionists","description":"Run a larger receptionist team for different roles or workflows."},{"label":"AI Outbound Calling","description":"Place outgoing calls for follow-ups, reminders, or outreach."},{"label":"Payments & Invoicing","description":"Receptionists can take payments, send invoices to customers, and more."},{"label":"Unlock All Receptionists","description":"Full access to the entire receptionist marketplace."},{"label":"AI Texting Automation","description":"Receptionists can send texts to customers."},{"label":"Unlimited Contacts","description":"Keep your full contact list without contact-based restrictions."},{"label":"Unlimited Scenarios","description":"Create as many workflow scenarios as your business needs."},{"label":"Train Receptionists","description":"Customize your receptionist with business context and behavioral instructions."}]'::jsonb
),
(
  'ultra',
  'Ultra',
  'Ultra',
  1,
  true,
  false,
  '{"description":"Built for high-scale operations, deeper customization, and maximum control","cta":"Try for 14 days"}'::jsonb,
  '{"included_call_minutes":5000,"max_receptionists":null,"max_scenarios":null,"max_contacts":null,"inbound_calling":true,"outbound_calling":true,"texting":true,"overage_enabled":false}'::jsonb,
  '[{"label":"5,000 included call minutes","description":"Use up to five thousand minutes of AI call time during each billing cycle."},{"label":"Everything in Pro","description":"Includes every Pro feature with more room to grow."},{"label":"Advanced AI Reasoning","description":"Gives receptionists stronger decision-making for more complex conversations."},{"label":"Voice Studio","description":"Customize voice experience more deeply for your team and brand."},{"label":"Professional Business Setup","description":"A dedicated onboarding specialist handles setup, configuration, and optimization."},{"label":"24/7 Human Support","description":"Reach real support anytime when you need help fast."}]'::jsonb
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
