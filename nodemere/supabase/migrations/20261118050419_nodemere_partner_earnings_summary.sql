create or replace function public.partner_totals(owner uuid default null)
returns jsonb language sql stable set search_path = '' as $$
    with referrals as (
        select r.status, r.review_flag, r.amount_cents, u.id is not null as ended_early
        from public.partner_referral_rows r
        left join public.users u on u.id = r.customer_id
            and u.subscription_status = 'canceled'
            and u.plan = 'free'
            and u.stripe_subscription_id is null
            and starts_with(u.stripe_customer_id, 'cus_')
            and u.trial_end_date >= (r.registered_at at time zone 'UTC')::date
            and r.status in ('registered', 'qualifying', 'held', 'expired')
            and r.qualified_at is null
            and r.paid_seconds < 2592000
        where owner is null or r.partner_id = owner
    )
    select jsonb_build_object(
        'registrations', count(*) filter (where review_flag is null),
        'qualified', count(*) filter (where status in ('ready', 'owed', 'paid')),
        'pending', coalesce(sum(amount_cents) filter (where status in ('registered', 'qualifying', 'held')), 0),
        'ready', coalesce(sum(amount_cents) filter (where status = 'ready'), 0),
        'owed', coalesce(sum(amount_cents) filter (where status = 'owed'), 0),
        'paid', coalesce(sum(amount_cents) filter (where status = 'paid'), 0),
        'ended_early', count(*) filter (where ended_early),
        'pending_total', coalesce(sum(amount_cents) filter (
            where status in ('registered', 'qualifying', 'held', 'ready', 'owed') and not ended_early), 0))
    from referrals;
$$;
