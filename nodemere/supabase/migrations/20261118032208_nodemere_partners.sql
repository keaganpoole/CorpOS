-- GoTrue uses this signed role for partner-only accounts. It has no database
-- privileges or membership in the Data API authenticator role.
create role nodemere_partner nologin noinherit;

create table public.partner_signup_attempts (
    key_hash text not null,
    bucket timestamptz not null,
    attempts integer not null default 1,
    primary key (key_hash, bucket)
);
create index partner_signup_attempts_by_time on public.partner_signup_attempts (bucket);

create function public.partner_signup_allowed(email_key text, network_key text)
returns boolean language plpgsql set search_path = '' as $$
declare
    window_start timestamptz := date_bin('10 minutes', now(), '2000-01-01'::timestamptz);
    email_count integer;
    network_count integer;
begin
    insert into public.partner_signup_attempts as quota (key_hash, bucket) values (email_key, window_start)
    on conflict (key_hash, bucket) do update set attempts = least(quota.attempts + 1, 4)
    returning quota.attempts into email_count;
    insert into public.partner_signup_attempts as quota (key_hash, bucket) values (network_key, window_start)
    on conflict (key_hash, bucket) do update set attempts = least(quota.attempts + 1, 61)
    returning quota.attempts into network_count;
    return email_count <= 3 and network_count <= 60;
end;
$$;

create table public.partner_accounts (
    id uuid primary key,
    email text not null,
    full_name text not null check (length(full_name) between 1 and 120),
    code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    email_updates boolean not null default true,
    payout_contact text not null default '' check (length(payout_contact) <= 300),
    created_at timestamptz not null default now()
);

create table public.partner_admins (
    partner_id uuid primary key references public.partner_accounts(id)
);

create table public.partner_visitors (
    id uuid primary key default gen_random_uuid(),
    partner_id uuid not null references public.partner_accounts(id),
    clicked_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '4320 hours')
);

create table public.partner_clicks (
    partner_id uuid not null references public.partner_accounts(id),
    visitor_id uuid not null,
    bucket timestamptz not null,
    clicked_at timestamptz not null default now(),
    primary key (partner_id, visitor_id, bucket)
);
create index partner_clicks_by_date on public.partner_clicks (partner_id, clicked_at);

create table public.partner_click_limits (
    partner_id uuid not null references public.partner_accounts(id),
    fingerprint text not null,
    bucket timestamptz not null,
    attempts int not null default 1,
    primary key (partner_id, fingerprint, bucket)
);
create index partner_click_limits_by_time on public.partner_click_limits (bucket);

create table public.partner_referrals (
    customer_id uuid primary key,
    referral_id uuid not null default gen_random_uuid() unique,
    partner_id uuid not null references public.partner_accounts(id),
    business_id bigint unique,
    clicked_at timestamptz not null,
    expires_at timestamptz not null,
    registered_at timestamptz not null,
    business_registered_at timestamptz,
    paid_seconds integer not null default 0 check (paid_seconds >= 0),
    paid_at timestamptz,
    qualified_at timestamptz,
    review_flag text,
    competing_attribution boolean not null default false,
    billing_checked_at timestamptz,
    billing_evidence jsonb not null default '[]',
    next_check_at timestamptz not null default now(),
    check_token uuid
);
create index partner_referrals_by_partner on public.partner_referrals (partner_id, registered_at desc);
create index partner_referrals_due on public.partner_referrals (next_check_at) where business_id is not null;

create table public.partner_rewards (
    customer_id uuid primary key references public.partner_referrals(customer_id),
    amount_cents integer not null default 10000 check (amount_cents = 10000),
    status text not null check (status in ('ready', 'owed', 'paid', 'rejected', 'held')),
    created_at timestamptz not null default now(),
    paid_on date
);

create table public.partner_reward_events (
    id bigint generated always as identity primary key,
    customer_id uuid not null references public.partner_rewards(customer_id),
    action text not null check (action in ('approve', 'reject', 'pay', 'hold')),
    actor_id uuid references public.partner_accounts(id),
    note text,
    created_at timestamptz not null default now()
);
create index partner_reward_events_by_customer on public.partner_reward_events (customer_id, id desc);

create table public.partner_email_outbox (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references public.partner_referrals(customer_id),
    event text not null check (event in ('registered', 'subscribed', 'qualified')),
    created_at timestamptz not null default now(),
    first_attempt_at timestamptz,
    next_attempt_at timestamptz not null default now(),
    sent_at timestamptz,
    skipped_at timestamptz,
    recipient text,
    unique (customer_id, event)
);
create index partner_email_due on public.partner_email_outbox (next_attempt_at)
    where sent_at is null and skipped_at is null;

create function public.partner_track_click(ref_code text, visitor uuid, visitor_fingerprint text)
returns uuid language plpgsql set search_path = '' as $$
declare
    owner_id uuid;
    visitor_id uuid;
    attempts integer;
begin
    select id into owner_id from public.partner_accounts where code = ref_code;
    if owner_id is null then return null; end if;

    insert into public.partner_click_limits as limits (partner_id, fingerprint, bucket)
    values (owner_id, visitor_fingerprint, date_bin('10 minutes', now(), '2000-01-01'::timestamptz))
    on conflict (partner_id, fingerprint, bucket) do update set attempts = least(limits.attempts + 1, 10000)
    returning limits.attempts into attempts;
    if attempts > 60 then return null; end if;

    -- Retain the first partner and original expiration for the lifetime of this cookie.
    select id into visitor_id from public.partner_visitors where id = visitor and expires_at > now();
    if visitor_id is null then
        insert into public.partner_visitors (partner_id) values (owner_id) returning id into visitor_id;
    end if;
    insert into public.partner_clicks (partner_id, visitor_id, bucket)
    values (owner_id, visitor_id, date_bin('30 minutes', now(), '2000-01-01'::timestamptz))
    on conflict do nothing;
    return visitor_id;
end;
$$;

-- Only the main Auth issuer may resolve a customer. This RPC also ignores
-- Supabase's obfuscated duplicate-signup responses, which have no auth.users row.
create function public.partner_capture_registration(visitor uuid, customer uuid)
returns void language sql security definer set search_path = '' as $$
    insert into public.partner_referrals as existing
        (customer_id, partner_id, clicked_at, expires_at, registered_at, review_flag)
    select u.id, v.partner_id, v.clicked_at, v.expires_at, u.created_at,
        case when lower(btrim(u.email)) = lower(btrim(p.email)) then 'Self-referral' end
    from public.partner_visitors v
    join public.partner_accounts p on p.id = v.partner_id
    join auth.users u on u.id = customer
    where v.id = visitor and now() < v.expires_at
        and u.created_at >= v.clicked_at and u.created_at < v.expires_at
        and u.created_at >= now() - interval '24 hours'
    on conflict (customer_id) do update set competing_attribution = true
    where existing.partner_id <> excluded.partner_id and not existing.competing_attribution;
$$;

create function public.partner_register_businesses()
returns void language sql security definer set search_path = '' as $$
    with candidates as (
        select r.customer_id, b.id, b.created_at
        from public.partner_referrals r
        join auth.users u on u.id = r.customer_id and u.email_confirmed_at is not null
        cross join lateral (
            select id, created_at
            from public.businesses b where b.user_id = r.customer_id order by id limit 1
        ) b
        where r.business_id is null and b.created_at >= r.registered_at and b.created_at < r.expires_at
        order by r.registered_at limit 100 for update of r skip locked
    ), attached as (
        update public.partner_referrals r set business_id = c.id, business_registered_at = c.created_at
        from candidates c where c.customer_id = r.customer_id
        returning r.customer_id, r.review_flag
    )
    insert into public.partner_email_outbox (customer_id, event)
    select customer_id, 'registered' from attached where review_flag is null
    on conflict do nothing;

    delete from public.partner_click_limits where bucket < now() - interval '1 day';
    delete from public.partner_signup_attempts where bucket < now() - interval '1 day';
    delete from public.partner_visitors where expires_at <= now();
$$;

create function public.partner_billing_jobs(target uuid default null)
returns setof public.partner_referrals language sql set search_path = '' as $$
    with jobs as (
        select r.customer_id from public.partner_referrals r
        left join public.partner_rewards w on w.customer_id = r.customer_id
        where r.business_id is not null and r.review_flag is null
            and (w.status is null or w.status in ('ready', 'owed', 'held'))
            and (target is null or r.customer_id = target)
            and (r.check_token is null or r.next_check_at <= now())
            and (target is not null or r.next_check_at <= now())
            and (w.status in ('ready', 'owed') or r.expires_at >= now() - interval '1 day'
                or r.billing_checked_at is null or r.billing_checked_at < r.expires_at)
        order by r.next_check_at limit 8 for update of r skip locked
    )
    update public.partner_referrals r
    set check_token = gen_random_uuid(), next_check_at = now() + interval '5 minutes'
    from jobs where jobs.customer_id = r.customer_id
    returning r.*;
$$;

create function public.partner_billing_result(
    target uuid, lease uuid, paid_time timestamptz, seconds_paid integer,
    qualified_time timestamptz, evidence jsonb, keep_lease boolean default false
) returns boolean language plpgsql set search_path = '' as $$
declare
    referral public.partner_referrals;
begin
    if qualified_time is not null and (qualified_time > now() or paid_time is null or seconds_paid < 2592000) then
        return false;
    end if;
    update public.partner_referrals r set
        paid_at = paid_time, paid_seconds = seconds_paid, qualified_at = qualified_time,
        billing_checked_at = now(), billing_evidence = evidence,
        check_token = case when keep_lease then r.check_token else null end,
        next_check_at = case when keep_lease then r.next_check_at else now() + interval '1 hour' end
    where r.customer_id = target and r.check_token = lease and r.next_check_at > now()
    returning r.* into referral;
    if not found then return false; end if;

    if paid_time is not null then
        insert into public.partner_email_outbox (customer_id, event) values (target, 'subscribed')
        on conflict do nothing;
    end if;
    if qualified_time is not null and qualified_time <= referral.expires_at
        and paid_time >= referral.registered_at and qualified_time >= paid_time + interval '720 hours' then
        insert into public.partner_rewards (customer_id, status) values (target, 'ready')
        on conflict (customer_id) do update set status = 'ready' where partner_rewards.status = 'held';
        insert into public.partner_email_outbox (customer_id, event) values (target, 'qualified')
        on conflict do nothing;
    else
        update public.partner_rewards set status = 'held' where customer_id = target and status in ('ready','owed');
        if found then
            insert into public.partner_reward_events (customer_id, action, note)
            values (target, 'hold', 'Updated billing evidence no longer supports eligibility.');
        end if;
    end if;
    return true;
end;
$$;

create function public.partner_reward_action(
    target uuid, admin uuid, requested_action text, action_note text,
    payment_date date, lease uuid default null
) returns text language plpgsql set search_path = '' as $$
declare
    current_status text;
    new_status text;
    referral public.partner_referrals;
begin
    if not exists (select 1 from public.partner_admins where partner_id = admin) then return 'forbidden'; end if;
    select * into referral from public.partner_referrals where customer_id = target for update;
    select status into current_status from public.partner_rewards where customer_id = target for update;
    if not found then return 'missing'; end if;
    new_status := case requested_action when 'approve' then 'owed' when 'reject' then 'rejected' when 'pay' then 'paid' end;
    if current_status = new_status then return current_status; end if;

    if requested_action = 'reject' then
        if current_status not in ('ready','owed','held') or nullif(btrim(action_note), '') is null then return 'conflict'; end if;
    elsif requested_action = 'approve' then
        if lease is null or referral.check_token is distinct from lease
            or referral.next_check_at <= now() or referral.qualified_at is null
            or referral.billing_checked_at < now() - interval '2 minutes'
            or current_status <> 'ready'
        then return 'conflict'; end if;
    elsif requested_action = 'pay' then
        if current_status <> 'owed' or payment_date is null or payment_date > (now() at time zone 'UTC')::date
        then return 'conflict'; end if;
    else
        return 'conflict';
    end if;

    update public.partner_rewards set status = new_status,
        paid_on = case when new_status = 'paid' then payment_date end
    where customer_id = target;
    insert into public.partner_reward_events (customer_id, action, actor_id, note)
    values (target, requested_action, admin, nullif(btrim(action_note), ''));
    update public.partner_referrals set check_token = null, next_check_at = now() + interval '1 hour'
    where customer_id = target;
    return new_status;
end;
$$;

create function public.partner_email_jobs()
returns setof public.partner_email_outbox language plpgsql set search_path = '' as $$
begin
    update public.partner_email_outbox o set skipped_at = now()
    from public.partner_referrals r join public.partner_accounts p on p.id = r.partner_id
    where o.customer_id = r.customer_id and o.sent_at is null and o.skipped_at is null
        and (o.first_attempt_at < now() - interval '23 hours' or (not p.email_updates and o.event <> 'qualified'));

    return query
    with pending as (
        select o.id, p.email from public.partner_email_outbox o
        join public.partner_referrals r on r.customer_id = o.customer_id
        join public.partner_accounts p on p.id = r.partner_id
        left join public.partner_rewards w on w.customer_id = r.customer_id
        where o.sent_at is null and o.skipped_at is null and o.next_attempt_at <= now()
            and (o.event <> 'qualified' or w.status in ('ready','owed','paid'))
        order by o.created_at limit 25 for update of o skip locked
    )
    update public.partner_email_outbox o set
        first_attempt_at = coalesce(o.first_attempt_at, now()),
        next_attempt_at = now() + interval '5 minutes',
        recipient = coalesce(o.recipient, pending.email)
    from pending where pending.id = o.id
    returning o.*;
end;
$$;

create view public.partner_referral_rows with (security_invoker = true) as
select r.*, w.paid_on, coalesce(w.amount_cents, 10000) as amount_cents,
    case
        when r.review_flag = 'Self-referral' then 'rejected'
        when w.status in ('ready','owed','paid','rejected') then w.status
        when r.expires_at <= now() then 'expired'
        when w.status = 'held' then 'held'
        when r.paid_at is not null then 'qualifying'
        else 'registered'
    end as status
from public.partner_referrals r left join public.partner_rewards w using (customer_id)
where r.business_id is not null;

create view public.partner_click_alerts with (security_invoker = true) as
select partner_id, sum(attempts - 60) as suppressed_clicks
from public.partner_click_limits where attempts > 60 and bucket > now() - interval '24 hours'
group by partner_id;

create function public.partner_totals(owner uuid default null)
returns jsonb language sql stable set search_path = '' as $$
    select jsonb_build_object(
        'registrations', count(*) filter (where review_flag is null),
        'qualified', count(*) filter (where status in ('ready','owed','paid')),
        'pending', coalesce(sum(amount_cents) filter (where status in ('registered','qualifying','held')),0),
        'ready', coalesce(sum(amount_cents) filter (where status = 'ready'),0),
        'owed', coalesce(sum(amount_cents) filter (where status = 'owed'),0),
        'paid', coalesce(sum(amount_cents) filter (where status = 'paid'),0))
    from public.partner_referral_rows where owner is null or partner_id = owner;
$$;

create function public.partner_analytics(owner uuid, days int)
returns jsonb language sql stable set search_path = '' as $$
    with period as (
        select (now() at time zone 'UTC')::date as today,
            (now() at time zone 'UTC')::date - (days - 1) as since
    ), clicks as (
        select * from public.partner_clicks where partner_id = owner
    ), registrations as (
        select registered_at from public.partner_referral_rows where partner_id = owner and review_flag is null
    ), bounds as (
        select today,
            coalesce(since, least((select (min(clicked_at) at time zone 'UTC')::date from clicks),
                                 (select (min(registered_at) at time zone 'UTC')::date from registrations)), today) as start_date
        from period
    ), click_counts as (
        select date_trunc(case when days is null or days >= 365 then 'month'
                    when days >= 90 then 'week' else 'day' end, clicked_at at time zone 'UTC')::date as date, count(*) as value
        from clicks, bounds where clicked_at >= (start_date::timestamp at time zone 'UTC') group by 1
    ), signup_counts as (
        select date_trunc(case when days is null or days >= 365 then 'month'
                    when days >= 90 then 'week' else 'day' end, registered_at at time zone 'UTC')::date as date, count(*) as value
        from registrations, bounds where registered_at >= (start_date::timestamp at time zone 'UTC') group by 1
    ), series as (
        select generate_series(
            date_trunc(case when days is null or days >= 365 then 'month'
                when days >= 90 then 'week' else 'day' end, start_date::timestamp),
            today::timestamp, case when days is null or days >= 365 then interval '1 month'
                when days >= 90 then interval '1 week' else interval '1 day' end
        )::date as date from bounds
    )
    select jsonb_build_object(
        'lifetime_clicks', (select count(*) from clicks),
        'lifetime_visitors', (select count(distinct visitor_id) from clicks),
        'clicks', (select coalesce(sum(value), 0) from click_counts),
        'unique_visitors', (select count(distinct visitor_id) from clicks, bounds where clicked_at >= (start_date::timestamp at time zone 'UTC')),
        'registrations', (select coalesce(sum(value), 0) from signup_counts),
        'series', (select jsonb_agg(jsonb_build_object('date', s.date, 'clicks', coalesce(c.value,0),
            'registrations', coalesce(r.value,0)) order by s.date)
            from series s left join click_counts c using (date) left join signup_counts r using (date)));
$$;

-- Only the FastAPI service role can access program records or run RPCs.
do $$
declare
    relation text;
    routine text;
begin
    foreach relation in array array[
        'partner_accounts', 'partner_admins', 'partner_visitors', 'partner_clicks', 'partner_click_limits',
        'partner_referrals', 'partner_rewards', 'partner_reward_events', 'partner_email_outbox',
        'partner_signup_attempts'
    ] loop
        execute format('alter table public.%I enable row level security', relation);
        execute format('revoke all on public.%I from public, anon, authenticated', relation);
        execute format('grant select, insert, update, delete on public.%I to service_role', relation);
    end loop;
    foreach routine in array array[
        'partner_signup_allowed(text,text)', 'partner_track_click(text,uuid,text)', 'partner_capture_registration(uuid,uuid)',
        'partner_register_businesses()', 'partner_billing_jobs(uuid)',
        'partner_billing_result(uuid,uuid,timestamptz,integer,timestamptz,jsonb,boolean)',
        'partner_reward_action(uuid,uuid,text,text,date,uuid)', 'partner_email_jobs()',
        'partner_totals(uuid)', 'partner_analytics(uuid,integer)'
    ] loop
        execute format('revoke all on function public.%s from public, anon, authenticated', routine);
        execute format('grant execute on function public.%s to service_role', routine);
    end loop;
end;
$$;
revoke all on public.partner_referral_rows, public.partner_click_alerts from public, anon, authenticated;
grant select on public.partner_referral_rows, public.partner_click_alerts to service_role;
grant usage on sequence public.partner_reward_events_id_seq to service_role;
