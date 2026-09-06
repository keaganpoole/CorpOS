-- Phase 1: apply once as database owner in Supabase SQL Editor.
-- Creates only new objects. No users/auth DDL, data changes, triggers or backfill.
-- service_role must already have BYPASSRLS (Supabase default). No customer policies.
-- RPCs use the raw service client; never accept user-supplied identity proof.
begin;

create schema visitor_private;
revoke all on schema visitor_private from public, anon, authenticated;
grant usage on schema visitor_private to service_role;

create table public.visitors (
  id uuid primary key,
  user_id uuid references public.users(id) on delete set null,
  account_linked_at timestamptz,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_received_at timestamptz not null,
  current_session_id uuid,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  fingerprint_version integer not null check (fingerprint_version > 0),
  fingerprint_updated_at timestamptz not null default clock_timestamp(),
  fingerprint_confidence numeric not null check (fingerprint_confidence between 0 and 60),
  identity_match_method text not null check (identity_match_method in ('new','persistent_id')),
  identity_confidence numeric not null check (identity_confidence between 0 and 100),
  consent_version text not null check (consent_version = '2026-09-05'),
  consent_updated_at timestamptz not null,
  revoked_at timestamptz,
  first_attribution jsonb not null default '{}',
  latest_attribution jsonb not null default '{}',
  device_profile jsonb not null default '{}',
  is_bot boolean not null default false,
  is_internal boolean not null default false,
  total_visits bigint not null default 0,
  total_pageviews bigint not null default 0,
  total_events bigint not null default 0,
  total_duration_seconds numeric not null default 0,
  total_engaged_seconds numeric not null default 0,
  homepage_engaged_seconds numeric not null default 0,
  longest_session_seconds numeric not null default 0,
  average_session_seconds numeric generated always as
    (case when total_visits>0 then total_duration_seconds/total_visits else 0 end) stored,
  first_page text,
  last_page text,
  signed_up_at timestamptz,
  time_to_signup_seconds numeric,
  signup_snapshot_complete boolean,
  visits_before_signup bigint,
  pageviews_before_signup bigint,
  duration_before_signup numeric,
  engaged_before_signup numeric,
  subscription_status text,
  stripe_subscription_id text,
  subscribed_at timestamptz
);
create index visitors_user_idx on public.visitors(user_id) where user_id is not null;
create index visitors_last_seen_idx on public.visitors(last_seen_at);
-- Fingerprints are diagnostic hints only: deliberately no uniqueness or lookup index.
create table public.visitor_sessions (
  id uuid primary key,
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_received_at timestamptz not null,
  ended_at timestamptz,
  last_engagement_at timestamptz not null,
  entry_page text,
  exit_page text,
  first_attribution jsonb not null default '{}',
  latest_attribution jsonb not null default '{}',
  device_profile jsonb not null default '{}',
  event_count bigint not null default 0,
  pageview_count bigint not null default 0,
  duration_seconds numeric not null default 0,
  engaged_seconds numeric not null default 0,
  homepage_engaged_seconds numeric not null default 0,
  max_scroll_depth numeric not null default 0,
  homepage_scroll_depth numeric not null default 0,
  unique (id, visitor_id)
);
create index visitor_sessions_visitor_idx on public.visitor_sessions(visitor_id, started_at desc);
create index visitor_sessions_retention_idx on public.visitor_sessions(last_received_at);
alter table public.visitors add foreign key (current_session_id)
  references public.visitor_sessions(id) on delete set null;
create table public.visitor_events (
  id uuid primary key,
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  session_id uuid,
  user_id uuid references public.users(id) on delete set null,
  event_name text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default clock_timestamp(),
  page text,
  metadata jsonb not null default '{}',
  conversion_key text unique,
  foreign key (session_id, visitor_id) references public.visitor_sessions(id, visitor_id)
);
create index visitor_events_visitor_idx on public.visitor_events(visitor_id, occurred_at desc);
create index visitor_events_session_idx on public.visitor_events(session_id);
create index visitor_events_retention_idx on public.visitor_events(received_at);
create unique index visitor_signup_once on public.visitor_events(user_id, event_name)
  where event_name = 'signup_completed';

-- Tiny durable receipts prevent replay after raw-event retention. No raw metadata.
-- session_id intentionally has no FK: an expired batch still returns its original ID.
create table visitor_private.event_receipts (
  id uuid primary key,
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  session_id uuid,
  received_at timestamptz not null default clock_timestamp()
);
create index visitor_receipts_session_idx on visitor_private.event_receipts(session_id);
-- Durable global conversion reservations survive raw retention and account deletion.
create table visitor_private.conversion_claims (
  conversion_key text primary key,
  user_id uuid not null,
  visitor_id uuid not null references public.visitors(id),
  event_id uuid not null unique,
  occurred_at timestamptz not null
);

alter table public.visitors enable row level security;
alter table public.visitors force row level security;
alter table public.visitor_sessions enable row level security;
alter table public.visitor_sessions force row level security;
alter table public.visitor_events enable row level security;
alter table public.visitor_events force row level security;
alter table visitor_private.event_receipts enable row level security;
alter table visitor_private.event_receipts force row level security;
alter table visitor_private.conversion_claims enable row level security;
alter table visitor_private.conversion_claims force row level security;
revoke all on public.visitors, public.visitor_sessions, public.visitor_events,
  visitor_private.event_receipts, visitor_private.conversion_claims from public, anon, authenticated;
grant all on public.visitors, public.visitor_sessions, public.visitor_events,
  visitor_private.event_receipts, visitor_private.conversion_claims to service_role;

create function public.visitor_ingest(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public, visitor_private
as $$
declare
  v public.visitors; s public.visitor_sessions;
  vid uuid; sid uuid; eid uuid; receipt visitor_private.event_receipts;
  e jsonb; a jsonb; m jsonb; device jsonb; consent jsonb;
  t timestamptz := clock_timestamp(); et timestamptz; first_event timestamptz;
  proof boolean; fresh boolean := false; new_session boolean := false; closing_batch boolean := false;
  n integer := 0; pending integer := 0; pages integer := 0;
  duration_delta numeric := 0; engaged_delta numeric := 0; home_delta numeric := 0;
  delta numeric; old_duration numeric; event_page text; batch_first_page text; batch_last_page text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 32768
    or jsonb_typeof(p_payload->'events') is distinct from 'array' then
    raise exception using errcode='22023', message='visitor_invalid_payload';
  end if;
  if jsonb_array_length(p_payload->'events') not between 1 and 40 then
    raise exception using errcode='22023', message='visitor_batch_limit';
  end if;
  vid := (p_payload->>'visitor_id')::uuid; sid := (p_payload->>'session_id')::uuid;
  proof := coalesce((p_payload->>'has_identity_proof')::boolean, false);
  consent := p_payload->'consent'; device := p_payload->'device_profile';
  if vid is null or sid is null or consent->'analytics' is distinct from 'true'::jsonb
    or consent->>'version' is distinct from '2026-09-05'
    or (consent->>'updated_at')::timestamptz is null
    or not isfinite((consent->>'updated_at')::timestamptz)
    or (consent->>'updated_at')::timestamptz > t + interval '5 minutes'
    or (p_payload->>'fingerprint') is null
    or (p_payload->>'fingerprint') !~ '^[0-9a-f]{64}$'
    or (p_payload->>'fingerprint_version')::integer is null
    or (p_payload->>'fingerprint_version')::integer < 1
    or (p_payload->>'fingerprint_confidence')::numeric is null
    or (p_payload->>'fingerprint_confidence')::numeric not between 0 and 60
    or p_payload->>'identity_match_method' is distinct from (case when proof then 'persistent_id' else 'new' end)
    or (p_payload->>'identity_confidence')::numeric is distinct from (case when proof then 100 else 0 end)::numeric
    or jsonb_typeof(device) is distinct from 'object'
    or jsonb_typeof(p_payload->'attribution') is distinct from 'object' then
    raise exception using errcode='22023', message='visitor_invalid_identity_or_consent';
  end if;
  -- Strict field allowlists are also enforced by the typed backend. Discard nothing
  -- silently: a changed backend contract must fail closed, not store arbitrary PII.
  if exists (select from jsonb_object_keys(device) k where k <> all(array[
    'browser','browser_version','os','os_version','device_type','screen_width','screen_height',
    'viewport_width','viewport_height','pixel_ratio','timezone','language','locale','touch_support']))
    or exists (select from jsonb_object_keys(p_payload->'attribution') k where k <> all(array[
    'landing_page','referrer','utm_source','utm_medium','utm_campaign','utm_term','utm_content'])) then
    raise exception using errcode='22023', message='visitor_invalid_fields';
  end if;
  a := jsonb_strip_nulls(p_payload->'attribution');
  -- Serialize creation too, including concurrent bootstrap with the same UUID.
  perform pg_advisory_xact_lock(hashtextextended('visitor:' || vid::text, 0));
  select * into v from public.visitors where id=vid for update;
  if found then
    if v.revoked_at is not null then raise exception 'visitor_revoked'; end if;
    if not proof then raise exception 'visitor_identity_required'; end if;
  else
    fresh := true;
  end if;
  first_event := t;
  -- Validate the whole batch before writing. Receipt lookup comes BEFORE session
  -- allocation; duplicate-only retries neither extend inactivity nor create visits.
  for e in select value from jsonb_array_elements(p_payload->'events') loop
    eid := (e->>'id')::uuid; et := (e->>'occurred_at')::timestamptz;
    m := coalesce(e->'metadata','{}'::jsonb);
    if eid is null or et is null or not isfinite(et)
      or et < t - interval '24 hours' or et > t + interval '5 minutes'
      or e->>'name' is null or e->>'name' <> all(array['session_start','session_end','page_view',
        'page_leave','engagement','cta_click','navigation_click','scroll_25','scroll_50','scroll_75',
        'scroll_90','scroll_100','form_started','field_focused','form_completed','signup_started','checkout_started'])
      or e->>'page' is null or e->>'page' <> all(array['/','/pricing','/auth','/privacy-policy','/terms',
        '/acceptable-use-policy','/communications-notice','/data-processing-addendum','/subprocessors','/cookie-notice'])
      or jsonb_typeof(m) <> 'object' then
      raise exception using errcode='22023', message='visitor_invalid_event';
    end if;
    if exists (select from jsonb_object_keys(m) k where k <> all(array[
      'engaged_seconds','scroll_depth','element_id','element_type','section_id','href',
      'device_class','form_id','field_id']))
      or (m->>'engaged_seconds')::numeric not between 0 and 60
      or (m->>'scroll_depth')::numeric not between 0 and 100 then
      raise exception using errcode='22023', message='visitor_invalid_metadata';
    end if;
    first_event := least(first_event,et);
    closing_batch := closing_batch or e->>'name'='session_end';
    select * into receipt from visitor_private.event_receipts where id=eid;
    if found then
      if receipt.visitor_id <> vid then raise exception 'visitor_event_conflict'; end if;
    else pending := pending+1;
    end if;
  end loop;
  if pending=0 then
    return jsonb_build_object('visitor_id',vid,'session_id',receipt.session_id,'accepted',0);
  end if;
  if fresh then
    insert into public.visitors(id, first_seen_at,last_seen_at,last_received_at,
      fingerprint,fingerprint_version,fingerprint_confidence,identity_match_method,identity_confidence,
      consent_version,consent_updated_at,first_attribution,latest_attribution,device_profile,is_bot,is_internal)
    values (vid,first_event,first_event,t,p_payload->>'fingerprint',
      (p_payload->>'fingerprint_version')::integer,(p_payload->>'fingerprint_confidence')::numeric,
      p_payload->>'identity_match_method',(p_payload->>'identity_confidence')::numeric,
      consent->>'version',least(t,(consent->>'updated_at')::timestamptz),a,a,device,
      coalesce((p_payload->>'is_bot')::boolean,false),coalesce((p_payload->>'is_internal')::boolean,false))
    returning * into v;
  end if;
  select * into s from public.visitor_sessions where id=v.current_session_id for update;
  if not found or s.ended_at is not null or (s.last_received_at <= t - interval '30 minutes'
    and not (closing_batch and sid=s.id)) then
    -- session_end is idle-timeout only; pagehide/refresh sends page_leave.
    update public.visitor_sessions set ended_at=last_seen_at where id=s.id;
    -- Reused/expired client IDs never overwrite an existing session.
    if exists(select from public.visitor_sessions where id=sid)
      or exists(select from visitor_private.event_receipts where session_id=sid) then
      sid := gen_random_uuid();
    end if;
    new_session := true;
    insert into public.visitor_sessions(id,visitor_id,user_id,started_at,last_seen_at,last_received_at,last_engagement_at,
      first_attribution,latest_attribution,device_profile)
    values(sid,vid,v.user_id,first_event,first_event,t,first_event,a,a,device) returning * into s;
  else
    sid := s.id;
  end if;
  old_duration := s.duration_seconds;
  for e in select value from jsonb_array_elements(p_payload->'events') with ordinality
    order by (value->>'occurred_at')::timestamptz, ordinality loop
    eid := (e->>'id')::uuid;
    insert into visitor_private.event_receipts(id,visitor_id,session_id,received_at)
      values(eid,vid,sid,t) on conflict (id) do nothing;
    if not found then
      -- Also catches another visitor racing a globally reused event UUID.
      if exists(select from visitor_private.event_receipts where id=eid and visitor_id<>vid) then
        raise exception 'visitor_event_conflict';
      end if;
      continue;
    end if;
    -- Keep buffered chronology independent of the current session's duration.
    et := least(t,(e->>'occurred_at')::timestamptz);
    event_page := e->>'page';
    batch_first_page := coalesce(batch_first_page,event_page); batch_last_page := event_page;
    m := coalesce(e->'metadata','{}'::jsonb);
    delta := 0;
    if e->>'name'='engagement' then
      delta := least(coalesce((m->>'engaged_seconds')::numeric,0),
        greatest(0,extract(epoch from et-s.last_engagement_at)),60,
        greatest(0,86400-s.engaged_seconds-engaged_delta));
      s.last_engagement_at := greatest(s.last_engagement_at,et);
      m := jsonb_set(m,'{engaged_seconds}',to_jsonb(delta));
      if event_page='/' then home_delta:=home_delta+delta; end if;
    else m := m-'engaged_seconds';
    end if;
    insert into public.visitor_events(id,visitor_id,session_id,user_id,event_name,occurred_at,received_at,page,metadata)
      values(eid,vid,sid,s.user_id,e->>'name',et,t,e->>'page',m);
    s.last_seen_at := greatest(s.last_seen_at,et);
    if e->>'name'='session_end' then s.ended_at:=s.last_seen_at; end if;
    s.max_scroll_depth := greatest(s.max_scroll_depth,coalesce((m->>'scroll_depth')::numeric,0));
    if event_page='/' then
      s.homepage_scroll_depth := greatest(s.homepage_scroll_depth,coalesce((m->>'scroll_depth')::numeric,0));
    end if;
    n := n+1; pages := pages + (e->>'name'='page_view')::integer;
    engaged_delta := engaged_delta+delta;
  end loop;
  s.duration_seconds := least(86400,greatest(0,extract(epoch from s.last_seen_at-s.started_at)));
  duration_delta := s.duration_seconds-old_duration;
  engaged_delta := least(engaged_delta,greatest(0,s.duration_seconds-s.engaged_seconds));
  update public.visitor_sessions set last_seen_at=s.last_seen_at,last_received_at=t,
    ended_at=s.ended_at,last_engagement_at=s.last_engagement_at,
    entry_page=coalesce(entry_page,batch_first_page),exit_page=batch_last_page,
    latest_attribution=latest_attribution || a, device_profile=device,
    event_count=event_count+n,pageview_count=pageview_count+pages,
    duration_seconds=s.duration_seconds,engaged_seconds=engaged_seconds+engaged_delta,
    homepage_engaged_seconds=homepage_engaged_seconds+home_delta,
    max_scroll_depth=s.max_scroll_depth,homepage_scroll_depth=s.homepage_scroll_depth where id=sid;
  update public.visitors set current_session_id=sid,last_seen_at=greatest(last_seen_at,s.last_seen_at),
    last_received_at=t,latest_attribution=case when new_session then a else latest_attribution || a end,device_profile=device,
    first_page=coalesce(first_page,batch_first_page),last_page=batch_last_page,
    fingerprint_updated_at=case when fingerprint is distinct from p_payload->>'fingerprint'
      or fingerprint_version is distinct from (p_payload->>'fingerprint_version')::integer then t else fingerprint_updated_at end,
    fingerprint=p_payload->>'fingerprint',fingerprint_version=(p_payload->>'fingerprint_version')::integer,
    fingerprint_confidence=(p_payload->>'fingerprint_confidence')::numeric,
    identity_match_method=p_payload->>'identity_match_method',
    identity_confidence=(p_payload->>'identity_confidence')::numeric,
    consent_updated_at=greatest(consent_updated_at,least(t,(consent->>'updated_at')::timestamptz)),
    is_bot=is_bot or coalesce((p_payload->>'is_bot')::boolean,false),
    is_internal=is_internal or coalesce((p_payload->>'is_internal')::boolean,false),
    total_visits=total_visits+new_session::integer,total_pageviews=total_pageviews+pages,
    total_events=total_events+n,total_duration_seconds=total_duration_seconds+duration_delta,
    total_engaged_seconds=total_engaged_seconds+engaged_delta,
    homepage_engaged_seconds=homepage_engaged_seconds+home_delta,
    longest_session_seconds=greatest(longest_session_seconds,s.duration_seconds) where id=vid;
  return jsonb_build_object('visitor_id',vid,'session_id',sid,'accepted',n);
end;
$$;

create function public.visitor_link_identity(p_visitor_id uuid,p_user_id uuid,
  p_account_created_at timestamptz,p_occurred_at timestamptz) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public, visitor_private
as $$
declare
  v public.visitors; account_time timestamptz; status text; sub text;
  t timestamptz := clock_timestamp(); event_id uuid := gen_random_uuid(); key text;
  converted boolean := false;
  logged_in boolean := false; login_key text; login_id uuid := gen_random_uuid();
  before_visits bigint; before_pages bigint; before_duration numeric; before_engaged numeric;
begin
  if p_user_id is null or p_occurred_at is null or not isfinite(p_occurred_at)
    or p_occurred_at > t+interval '5 minutes' or p_occurred_at < t-interval '24 hours' then
    raise exception using errcode='22023', message='visitor_invalid_identity_time';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('visitor-user:'||p_user_id::text,0));
  select * into v from public.visitors where id=p_visitor_id for update;
  if not found then raise exception 'visitor_not_found'; end if;
  if v.revoked_at is not null then raise exception 'visitor_revoked'; end if;
  if (v.user_id is not null and v.user_id<>p_user_id)
    or (v.user_id is null and v.account_linked_at is not null) then
    return jsonb_build_object('visitor_id',v.id,'conflict',true);
  end if;
  select subscription_status,stripe_subscription_id into status,sub
    from public.users where id=p_user_id;
  if not found then raise exception 'visitor_user_not_found'; end if;
  -- Backend supplies VERIFIED Supabase Auth creation time. A public profile may
  -- have been created much later; it is only an existence/FK check, not the clock.
  account_time := p_account_created_at;
  if account_time is null or not isfinite(account_time) or account_time>t then
    raise exception 'visitor_invalid_account_time';
  end if;
  update public.visitors set user_id=p_user_id,account_linked_at=coalesce(account_linked_at,t),
    subscription_status=status,stripe_subscription_id=sub where id=v.id;
  update public.visitor_sessions set user_id=p_user_id where visitor_id=v.id and user_id is null;
  update public.visitor_events set user_id=p_user_id where visitor_id=v.id and user_id is null;
  -- No backward tolerance: an account predating acquisition is a login, not signup.
  -- Late email verification is a newly observed link to a real Auth signup. Record
  -- that verified account time; never backfill unobserved visitors or subscriptions.
  if account_time>=v.first_seen_at and account_time<=least(t,p_occurred_at)
    and not v.is_bot and not v.is_internal then
    key := 'signup:'||p_user_id::text;
    insert into visitor_private.conversion_claims(conversion_key,user_id,visitor_id,event_id,occurred_at)
      values(key,p_user_id,v.id,event_id,account_time) on conflict do nothing;
    converted := found;
    if converted then
      -- Subtract post-account activity from lifetime counters. Only this conversion
      -- query reads history; ingestion never recounts it. For links delayed beyond
      -- raw retention, mark unavailable metrics NULL instead of inventing accuracy.
      select v.total_visits-count(*) filter(where started_at>account_time),
        v.total_duration_seconds-coalesce(sum(duration_seconds-least(duration_seconds,
          greatest(0,extract(epoch from account_time-started_at)))),0)
        into before_visits,before_duration from public.visitor_sessions
        where visitor_id=v.id and last_seen_at>account_time;
      select v.total_pageviews-count(*) filter(where event_name='page_view'),
        v.total_engaged_seconds-coalesce(sum(case when event_name='engagement' then
          least(coalesce((metadata->>'engaged_seconds')::numeric,0),
            extract(epoch from occurred_at-account_time)) else 0 end),0)
        into before_pages,before_engaged from public.visitor_events
        where visitor_id=v.id and occurred_at>account_time;
      if account_time<t-interval '90 days' then
        before_visits:=null; before_pages:=null; before_duration:=null; before_engaged:=null;
      end if;
      insert into public.visitor_events(id,visitor_id,session_id,user_id,event_name,occurred_at,received_at,conversion_key,metadata)
      values(event_id,v.id,v.current_session_id,p_user_id,'signup_completed',account_time,t,key,
        jsonb_build_object('visits_before_signup',before_visits,'pageviews_before_signup',before_pages,
          'duration_before_signup',before_duration,'engaged_before_signup',before_engaged));
      update public.visitors set signed_up_at=account_time,visits_before_signup=before_visits,
        time_to_signup_seconds=extract(epoch from account_time-v.first_seen_at),
        signup_snapshot_complete=(account_time>=t-interval '90 days'),
        pageviews_before_signup=before_pages,duration_before_signup=before_duration,
        engaged_before_signup=before_engaged,total_events=total_events+1 where id=v.id;
      update public.visitor_sessions set event_count=event_count+1 where id=v.current_session_id;
    end if;
  end if;
  if v.current_session_id is not null then
    login_key := 'login:'||v.current_session_id::text||':'||p_user_id::text;
    insert into visitor_private.conversion_claims(conversion_key,user_id,visitor_id,event_id,occurred_at)
      values(login_key,p_user_id,v.id,login_id,least(t,p_occurred_at)) on conflict do nothing;
    logged_in := found;
    if logged_in then
      insert into public.visitor_events(id,visitor_id,session_id,user_id,event_name,occurred_at,received_at,conversion_key)
        values(login_id,v.id,v.current_session_id,p_user_id,'login',least(t,p_occurred_at),t,login_key);
      update public.visitors set total_events=total_events+1 where id=v.id;
      update public.visitor_sessions set event_count=event_count+1 where id=v.current_session_id;
    end if;
  end if;
  return jsonb_build_object('visitor_id',v.id,'conflict',false,'signup_created',converted,'login_created',logged_in);
end;
$$;

create function public.visitor_subscription_conversion(p_user_id uuid,p_subscription_id text,
  p_occurred_at timestamptz) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public, visitor_private
as $$
declare
  v public.visitors; t timestamptz := clock_timestamp(); event_id uuid := gen_random_uuid();
  key text; converted boolean; status text; conversion_time timestamptz;
begin
  if p_user_id is null or p_subscription_id is null or p_subscription_id !~ '^sub_[A-Za-z0-9]{1,200}$'
    or p_occurred_at is null or not isfinite(p_occurred_at)
    or p_occurred_at>t+interval '5 minutes' or p_occurred_at<t-interval '24 hours' then
    raise exception using errcode='22023', message='visitor_invalid_subscription';
  end if;
  -- Called ONLY by a verified Stripe lifecycle handler, never browser collect/link.
  perform pg_advisory_xact_lock(hashtextextended('visitor-user:'||p_user_id::text,0));
  perform 1 from public.visitors where user_id=p_user_id order by id for update;
  select * into v from public.visitors where user_id=p_user_id and revoked_at is null
    -- Stripe created timestamps have whole-second precision; allow only that loss.
    and not is_bot and not is_internal and first_seen_at<p_occurred_at+interval '1 second'
    order by last_seen_at desc,id limit 1;
  if not found then return jsonb_build_object('accepted',0); end if;
  conversion_time := greatest(v.first_seen_at,least(t,p_occurred_at));
  select subscription_status into status from public.users where id=p_user_id;
  if not found then raise exception 'visitor_user_not_found'; end if;
  key := 'subscription:'||p_subscription_id;
  insert into visitor_private.conversion_claims(conversion_key,user_id,visitor_id,event_id,occurred_at)
    values(key,p_user_id,v.id,event_id,conversion_time) on conflict do nothing;
  converted := found;
  if not converted then
    if exists(select from visitor_private.conversion_claims where conversion_key=key and user_id<>p_user_id) then
      raise exception 'visitor_subscription_conflict';
    end if;
    return jsonb_build_object('accepted',0);
  end if;
  insert into public.visitor_events(id,visitor_id,session_id,user_id,event_name,occurred_at,received_at,conversion_key)
    values(event_id,v.id,v.current_session_id,p_user_id,'subscription_created',conversion_time,t,key);
  update public.visitors set subscription_status=status,stripe_subscription_id=p_subscription_id,
    subscribed_at=coalesce(subscribed_at,greatest(first_seen_at,least(t,p_occurred_at))),
    total_events=total_events+(id=v.id)::integer where user_id=p_user_id and revoked_at is null;
  update public.visitor_sessions set event_count=event_count+1 where id=v.current_session_id;
  return jsonb_build_object('visitor_id',v.id,'accepted',1);
end;
$$;

create function public.visitor_revoke(p_visitor_id uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public, visitor_private
as $$
declare v public.visitors;
begin
  select * into v from public.visitors where id=p_visitor_id for update;
  if not found then raise exception 'visitor_not_found'; end if;
  update public.visitors set revoked_at=coalesce(revoked_at,clock_timestamp()) where id=v.id;
  return jsonb_build_object('visitor_id',v.id,'revoked',true);
end;
$$;

-- Explicit opt-in maintenance; migration never executes retention. Bounded work.
-- Preserve visitor totals/acquisition/revocation and durable receipts/claims. Visitor
-- IDs are NOT deleted at 365d: deletion would permit resuscitation and double signup.
create function public.visitor_retention(p_limit integer default 1000) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public, visitor_private
as $$
declare raw_count integer; session_count integer;
begin
  if p_limit is null or p_limit not between 1 and 10000 then
    raise exception using errcode='22023', message='visitor_retention_limit';
  end if;
  with doomed as (select id from public.visitor_events
    where received_at<clock_timestamp()-interval '90 days' order by received_at
    limit p_limit for update skip locked)
  delete from public.visitor_events e using doomed d where e.id=d.id;
  get diagnostics raw_count=row_count;
  -- Sessions with unpruned raw events wait for the next maintenance run.
  with doomed as (select s.id from public.visitor_sessions s
    where s.last_received_at<clock_timestamp()-interval '365 days'
      and not exists(select from public.visitor_events e where e.session_id=s.id)
      and not exists(select from public.visitors v where v.current_session_id=s.id)
    order by s.last_received_at limit p_limit for update of s skip locked)
  delete from public.visitor_sessions s using doomed d where s.id=d.id;
  get diagnostics session_count=row_count;
  return jsonb_build_object('events_deleted',raw_count,'sessions_deleted',session_count);
end;
$$;

revoke all on function public.visitor_ingest(jsonb),
  public.visitor_link_identity(uuid,uuid,timestamptz,timestamptz),
  public.visitor_subscription_conversion(uuid,text,timestamptz),
  public.visitor_revoke(uuid),public.visitor_retention(integer) from public, anon, authenticated;
grant execute on function public.visitor_ingest(jsonb),
  public.visitor_link_identity(uuid,uuid,timestamptz,timestamptz),
  public.visitor_subscription_conversion(uuid,text,timestamptz),
  public.visitor_revoke(uuid),public.visitor_retention(integer) to service_role;
notify pgrst, 'reload schema';
commit;
