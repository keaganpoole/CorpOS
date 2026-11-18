alter table public.partner_accounts
    add column short_code text unique check (short_code ~ '^[1-9][0-9]{3}$'),
    add constraint partner_accounts_legacy_code_format check (code ~ '^[a-f0-9]{12}$');

-- Existing codes remain valid aliases for shared links.
with accounts as (
    select id, row_number() over (order by id) as position
    from public.partner_accounts
), codes as (
    select code::text, row_number() over (order by random()) as position
    from generate_series(1000, 9999) as code
)
update public.partner_accounts p set short_code = codes.code
from accounts join codes using (position)
where p.id = accounts.id;

alter table public.partner_accounts alter column short_code set not null;

create function public.partner_assign_short_code()
returns trigger language plpgsql set search_path = '' as $$
begin
    -- Serialize allocation so simultaneous signups cannot pick the same number.
    perform pg_advisory_xact_lock(hashtextextended('public.partner_accounts.short_code', 0));

    -- A retried account insert keeps its original assignment, even at capacity.
    select p.short_code into new.short_code from public.partner_accounts p where p.id = new.id;
    if found then return new; end if;

    select candidate::text into new.short_code
    from generate_series(1000, 9999) as candidate
    where not exists (select 1 from public.partner_accounts p where p.short_code = candidate::text)
    order by random() limit 1;
    if new.short_code is null then
        raise exception using errcode = 'P9000', message = 'No four-digit referral codes are available';
    end if;
    return new;
end;
$$;

revoke all on function public.partner_assign_short_code() from public, anon, authenticated;
grant execute on function public.partner_assign_short_code() to service_role;

create trigger partner_assign_short_code
before insert on public.partner_accounts
for each row execute function public.partner_assign_short_code();

create or replace function public.partner_track_click(ref_code text, visitor uuid, visitor_fingerprint text)
returns uuid language plpgsql set search_path = '' as $$
declare
    owner_id uuid;
    visitor_id uuid;
    attempts integer;
begin
    select id into owner_id from public.partner_accounts where short_code = ref_code or code = ref_code;
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
