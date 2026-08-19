-- User billing fields required by checkout, Stripe webhooks, and billing state.
-- Run this once in the Supabase SQL Editor before using paid checkout.

begin;

alter table public.users
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists billing_period text,
  add column if not exists source text,
  add column if not exists trial_start_date date,
  add column if not exists trial_end_date date,
  add column if not exists started_trial boolean not null default false,
  add column if not exists months_subscribed integer not null default 0,
  add column if not exists card_retries integer not null default 0,
  add column if not exists latest_charge_attempt timestamptz,
  add column if not exists log text;

create index if not exists users_stripe_customer_id_idx
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists users_stripe_subscription_id_idx
  on public.users (stripe_subscription_id)
  where stripe_subscription_id is not null;

commit;
