-- Run only against an isolated database with the Partners migration applied.
begin;
set local role postgres;

do $$
declare
    first_partner uuid := gen_random_uuid();
    second_partner uuid := gen_random_uuid();
    owner uuid := gen_random_uuid();
    self_referred uuid := gen_random_uuid();
    existing_owner uuid := gen_random_uuid();
    expired_owner uuid := gen_random_uuid();
    browser uuid;
    second_browser uuid;
    lease uuid;
    result text;
begin
    if has_table_privilege('authenticated', 'public.partner_rewards', 'update')
        or has_table_privilege('anon', 'public.partner_referral_rows', 'select')
        or has_function_privilege('authenticated', 'public.partner_reward_action(uuid,uuid,text,text,date,uuid)', 'execute') then
        raise exception 'The Data API exposes restricted partner records';
    end if;
    if pg_has_role('authenticated', 'nodemere_partner', 'member')
        or has_table_privilege('nodemere_partner', 'public.partner_rewards', 'select') then
        raise exception 'Partner role has unexpected database privileges';
    end if;
    for attempt in 1..3 loop
        if not public.partner_signup_allowed('email-fixture', 'network-fixture') then
            raise exception 'Signup was throttled before its limit';
        end if;
    end loop;
    if public.partner_signup_allowed('email-fixture', 'network-fixture') then
        raise exception 'Signup passed after exceeding the email limit';
    end if;

    insert into public.partner_accounts (id, email, full_name, code)
    values (first_partner, 'first@example.test', 'First partner', '0123456789ab'),
           (second_partner, 'second@example.test', 'Second partner', 'abcdef012345');
    insert into public.partner_admins values (second_partner);

    browser := public.partner_track_click('0123456789ab', null, 'test-network');
    if browser is null
        or public.partner_track_click('0123456789ab', browser, 'test-network') <> browser
        or public.partner_track_click('abcdef012345', browser, 'test-network') <> browser then
        raise exception 'Repeat or competing click replaced the browser';
    end if;
    if (select count(*) from public.partner_clicks where visitor_id = browser) <> 2
        or (select partner_id from public.partner_visitors where id = browser) <> first_partner
        or (select expires_at - clicked_at from public.partner_visitors where id = browser) <> interval '4320 hours' then
        raise exception 'Click attribution, expiration or deduplication is incorrect';
    end if;

    update public.partner_visitors set clicked_at = now() - interval '40 days',
        expires_at = now() + interval '140 days' where id = browser;
    insert into auth.users (id, email, created_at, email_confirmed_at)
    values (owner, 'new@example.test', now() - interval '1 minute', now()),
           (self_referred, 'FIRST@example.test', now() - interval '1 minute', now()),
           (existing_owner, 'original@example.test', now() - interval '50 days', now());
    perform public.partner_capture_registration(browser, owner);
    perform public.partner_capture_registration(browser, owner);
    perform public.partner_capture_registration(browser, self_referred);
    perform public.partner_capture_registration(browser, existing_owner);
    second_browser := public.partner_track_click('abcdef012345', null, 'test-network');
    update public.partner_visitors set clicked_at = now() - interval '1 day' where id = second_browser;
    perform public.partner_capture_registration(second_browser, owner);
    if not exists (select 1 from public.partner_referrals
        where customer_id = owner and partner_id = first_partner and competing_attribution) then
        raise exception 'A competing claim was not flagged or changed the owner';
    end if;
    update public.partner_visitors set expires_at = now() - interval '1 second' where id = second_browser;
    insert into auth.users (id, email, created_at, email_confirmed_at)
    values (expired_owner, 'late@example.test', now(), now());
    perform public.partner_capture_registration(second_browser, expired_owner);
    if exists (select 1 from public.partner_referrals where customer_id = expired_owner) then
        raise exception 'An expired link captured a registration';
    end if;
    if public.partner_track_click('abcdef012345', second_browser, 'test-network') = second_browser then
        raise exception 'An expired browser token was reused';
    end if;
    for attempt in 1..62 loop
        perform public.partner_track_click('abcdef012345', browser, 'burst-test');
    end loop;
    if not exists (select 1 from public.partner_click_alerts where partner_id = second_partner and suppressed_clicks = 2) then
        raise exception 'Suspicious traffic was not rate-limited';
    end if;

    perform public.partner_register_businesses();
    if exists (select 1 from public.partner_referral_rows where partner_id = first_partner)
        or exists (select 1 from public.partner_referrals where customer_id = existing_owner) then
        raise exception 'Unregistered or pre-existing business appeared in attribution';
    end if;
    -- Fixture businesses use negative IDs in the disposable test schema.
    insert into public.businesses (id, user_id, name, created_at)
    values (-1001, owner, 'New business', now()), (-1002, self_referred, 'Self-referral fixture', now());
    perform public.partner_register_businesses();
    if (select status from public.partner_referral_rows where customer_id = self_referred) <> 'rejected'
        or (select status from public.partner_referral_rows where customer_id = owner) <> 'registered' then
        raise exception 'Free or self-referral classification failed';
    end if;
    update public.partner_referrals set registered_at = now() - interval '840 hours' where customer_id = owner;

    select check_token into lease from public.partner_billing_jobs(owner);
    if lease is null or exists (select 1 from public.partner_billing_jobs(owner)) then
        raise exception 'Billing lease was absent or acquired twice';
    end if;
    perform public.partner_billing_result(owner, lease, null, 0, null, '[]');
    if exists (select 1 from public.partner_rewards where customer_id = owner) then
        raise exception 'An unpaid registration produced a reward';
    end if;

    select check_token into lease from public.partner_billing_jobs(owner);
    perform public.partner_billing_result(owner, lease, now() - interval '720 hours', 2592000, now(), '[]', true);
    if public.partner_reward_action(owner, first_partner, 'approve', '', null, lease) <> 'forbidden'
        or public.partner_reward_action(owner, second_partner, 'approve', '', null, lease) <> 'owed'
        or public.partner_reward_action(owner, second_partner, 'approve', '', null, lease) <> 'owed' then
        raise exception 'Approval authorization or idempotency failed';
    end if;
    -- A refund before payout holds the reward and revokes spendability.
    select check_token into lease from public.partner_billing_jobs(owner);
    perform public.partner_billing_result(owner, lease, null, 0, null, '[]');
    if (select status from public.partner_referral_rows where customer_id = owner) <> 'held' then
        raise exception 'Lost eligibility left a reward payable';
    end if;
    select check_token into lease from public.partner_billing_jobs(owner);
    perform public.partner_billing_result(owner, lease, now() - interval '720 hours', 2592000, now(), '[]', true);
    perform public.partner_reward_action(owner, second_partner, 'approve', '', null, lease);
    select check_token into lease from public.partner_billing_jobs(owner);
    result := public.partner_reward_action(owner, second_partner, 'pay', 'Transfer recorded', current_date);
    if result <> 'paid' or public.partner_reward_action(owner, second_partner, 'pay', 'Duplicate', current_date) <> 'paid'
        or (select count(*) from public.partner_reward_events where customer_id = owner and action = 'pay') <> 1
        or (public.partner_totals(first_partner)->>'paid')::int <> 10000
        or (public.partner_totals(second_partner)->>'paid')::int <> 0 then
        raise exception 'Payment was duplicated, lost, or leaked to the wrong partner';
    end if;
    if public.partner_billing_result(owner, lease, null, 0, null, '[]') then
        raise exception 'A stale billing lease overwrote a recorded payment';
    end if;

    if (select count(*) from public.partner_email_outbox where customer_id = owner) <> 3
        or (select count(*) from public.partner_email_jobs() where customer_id = owner) <> 3
        or exists (select 1 from public.partner_email_jobs() where customer_id = owner)
        or (public.partner_analytics(first_partner, 30)->>'clicks')::int <> 1 then
        raise exception 'Notification deduplication or click aggregation failed';
    end if;

    -- Rejection is terminal and its reason stays in the internal audit log.
    insert into public.partner_referrals
        (customer_id, partner_id, business_id, clicked_at, expires_at, registered_at)
    values (expired_owner, first_partner, -1003, now() - interval '35 days', now() + interval '145 days',
            now() - interval '32 days');
    insert into public.partner_rewards (customer_id, status) values (expired_owner, 'ready');
    result := public.partner_reward_action(expired_owner, second_partner, 'reject', '', null);
    if result is distinct from 'conflict' then raise exception 'A rejection without a reason returned %', result; end if;
    result := public.partner_reward_action(expired_owner, second_partner, 'reject', 'Review finding', null);
    if result is distinct from 'rejected' then raise exception 'The valid rejection returned %', result; end if;
    result := public.partner_reward_action(expired_owner, second_partner, 'reject', 'Repeated', null);
    if result is distinct from 'rejected'
        or (select count(*) from public.partner_reward_events where customer_id = expired_owner) <> 1
        or exists (select 1 from public.partner_billing_jobs(expired_owner)) then
        raise exception 'Rejection requirements or terminal state failed';
    end if;
end;
$$;

rollback;
