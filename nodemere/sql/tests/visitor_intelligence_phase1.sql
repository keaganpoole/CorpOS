-- Run AFTER migration as database owner. All fixtures, grants and writes roll back.
-- Synthetic auth/public users only; never reads or changes an existing customer.
-- Any assertion/exception aborts the transaction: ROLLBACK before rerunning.
begin;
set local statement_timeout = '30s';

create temporary table visitor_test_fixture (u1 uuid, u2 uuid, old_user uuid, buffered_user uuid, account_time timestamptz);
insert into visitor_test_fixture values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),clock_timestamp()-interval '10 seconds');
grant select on visitor_test_fixture to service_role;
do $$
declare r record; uid uuid; ct timestamptz;
begin
  select * into r from visitor_test_fixture;
  foreach uid in array array[r.u1,r.u2,r.old_user,r.buffered_user] loop
    if exists(select from public.users where id=uid) then raise exception 'fixture UUID collision'; end if;
    ct := case when uid=r.old_user then r.account_time-interval '1 year' else r.account_time end;
    if to_regclass('auth.users') is not null then
      execute 'insert into auth.users(id,email,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
        values($1,$2,$3,$3,''{}'', ''{"first_name":"Visitor SQL","last_name":"Fixture"}'')'
        using uid,'visitor-sql-'||uid::text||'@example.invalid',ct;
    end if;
    -- Existing auth trigger may already have made this NEW fixture's profile.
    insert into public.users(id,created_at) values(uid,ct)
      on conflict(id) do update set created_at=excluded.created_at;
  end loop;
end;
$$;

set local role service_role;
do $$
declare
  f record; vid uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); oldvid uuid:=gen_random_uuid();
  sid uuid:=gen_random_uuid(); first_sid uuid; second_sid uuid;
  e1 uuid:=gen_random_uuid(); e2 uuid:=gen_random_uuid(); e3 uuid:=gen_random_uuid();
  t timestamptz:=clock_timestamp(); payload jsonb; initial jsonb; retry_batch jsonb; result jsonb;
  before_count bigint; before_pages bigint; before_visits bigint; before_duration numeric; before_engaged numeric;
begin
  select * into f from visitor_test_fixture;
  -- Also exercises direct INSERT privileges with FORCE RLS under service_role.
  insert into public.visitors(id,first_seen_at,last_seen_at,last_received_at,fingerprint,fingerprint_version,
    fingerprint_confidence,identity_match_method,identity_confidence,consent_version,consent_updated_at)
    values(gen_random_uuid(),t,t,t,repeat('b',64),1,60,'new',0,'2026-09-05',t);
  payload := jsonb_build_object('visitor_id',vid,'session_id',sid,'has_identity_proof',false,
    'fingerprint',repeat('a',64),'fingerprint_version',1,'fingerprint_confidence',60,
    'identity_match_method','new','identity_confidence',0,
    'consent',jsonb_build_object('analytics',true,'version','2026-09-05','updated_at',t),
    'attribution',jsonb_build_object('landing_page','/','referrer','https://example.com',
      'utm_source','first-source','utm_campaign','first-campaign'),
    'device_profile',jsonb_build_object('browser','Fixture','device_type','desktop'),
    'is_bot',false,'is_internal',false,
    'events',jsonb_build_array(jsonb_build_object('id',e1,'name','page_view',
      'occurred_at',t-interval '60 seconds','page','/','metadata','{}'::jsonb),
      jsonb_build_object('id',e2,'name','engagement','occurred_at',t-interval '30 seconds','page','/',
      'metadata',jsonb_build_object('engaged_seconds',60))));
  initial:=payload;
  result:=public.visitor_ingest(payload); first_sid:=(result->>'session_id')::uuid;
  assert (result->>'accepted')::int=2, 'initial accepted';
  assert (select total_visits=1 and total_pageviews=1 and total_events=2
    and total_duration_seconds=30 and total_engaged_seconds=30 from public.visitors where id=vid), 'initial aggregates/clamp';
  -- Bare UUID, even with identical bootstrap event IDs, is not proof.
  begin
    perform public.visitor_ingest(payload); raise exception 'bare replay allowed';
  exception when raise_exception then
    if sqlerrm<>'visitor_identity_required' then raise; end if;
  end;
  payload:=payload||jsonb_build_object('has_identity_proof',true,'identity_match_method','persistent_id','identity_confidence',100);
  result:=public.visitor_ingest(payload);
  assert (result->>'accepted')::int=0 and (result->>'session_id')::uuid=first_sid,'duplicate retry';
  assert (select total_events=2 and total_visits=1 from public.visitors where id=vid),'dedup counters';
  -- Navigation supplies only a new landing: first acquisition stays immutable and
  -- latest session touch retains previously supplied referrer/UTM keys.
  payload:=payload||jsonb_build_object('session_id',gen_random_uuid(),
    'attribution',jsonb_build_object('landing_page','/pricing'),
    'events',jsonb_build_array(jsonb_build_object('id',e3,'name','page_view',
      'occurred_at',t-interval '20 seconds','page','/pricing','metadata','{}'::jsonb)));
  result:=public.visitor_ingest(payload);
  assert (result->>'session_id')::uuid=first_sid,'refresh/navigation must reuse active session';
  assert (select first_attribution->>'landing_page'='/' and first_attribution->>'utm_source'='first-source'
    and latest_attribution->>'landing_page'='/pricing' and latest_attribution->>'utm_source'='first-source'
    from public.visitors where id=vid),'immutable first acquisition';
  assert (select latest_attribution->>'referrer'='https://example.com'
    and latest_attribution->>'utm_campaign'='first-campaign' from public.visitor_sessions where id=first_sid),'session attribution retention';
  -- Client start/end names themselves never increment session counters.
  payload:=payload||jsonb_build_object('events',jsonb_build_array(
    jsonb_build_object('id',gen_random_uuid(),'name','session_end','occurred_at',t-interval '19 seconds','page','/'),
    jsonb_build_object('id',gen_random_uuid(),'name','session_start','occurred_at',t-interval '18 seconds','page','/')));
  perform public.visitor_ingest(payload);
  assert (select total_visits=1 from public.visitors where id=vid),'supplied start/end count';
  -- Duplicate-only expired batch must NOT allocate another session or advance clocks.
  update public.visitor_sessions set last_received_at=t-interval '31 minutes' where id=first_sid;
  result:=public.visitor_ingest(payload);
  assert (result->>'accepted')::int=0 and (result->>'session_id')::uuid=first_sid,'expired duplicate';
  assert (select total_visits=1 from public.visitors where id=vid),'expired retry visit inflation';
  payload:=payload||jsonb_build_object('session_id',first_sid,'events',jsonb_build_array(
    jsonb_build_object('id',gen_random_uuid(),'name','page_view','occurred_at',t-interval '17 seconds','page','/pricing')));
  retry_batch:=payload;
  result:=public.visitor_ingest(payload); second_sid:=(result->>'session_id')::uuid;
  assert second_sid<>first_sid and (select total_visits=2 from public.visitors where id=vid),'timeout creates actual session';
  result:=public.visitor_ingest(retry_batch);
  assert (result->>'accepted')::int=0 and (result->>'session_id')::uuid=second_sid,'original parent retry mapping';
  assert (select total_visits=2 from public.visitors where id=vid),'atomic retry visits';
  -- Duplicate within one batch and a fresh event: count each ID only once.
  e3:=gen_random_uuid();
  payload:=payload||jsonb_build_object('events',jsonb_build_array(
    jsonb_build_object('id',e3,'name','page_view','occurred_at',t-interval '16 seconds','page','/'),
    jsonb_build_object('id',e3,'name','page_view','occurred_at',t-interval '16 seconds','page','/')));
  result:=public.visitor_ingest(payload);
  assert (result->>'accepted')::int=1,'within batch dedup';
  select total_events,total_visits into before_count,before_visits from public.visitors where id=vid;
  -- A valid event followed by invalid data cannot leave a partial event/session.
  payload:=payload||jsonb_build_object('events',jsonb_build_array(
    jsonb_build_object('id',gen_random_uuid(),'name','page_view','occurred_at',t,'page','/'),
    jsonb_build_object('id',gen_random_uuid(),'name','engagement','occurred_at',t,'page','/',
      'metadata',jsonb_build_object('engaged_seconds',61))));
  begin
    perform public.visitor_ingest(payload); raise exception 'invalid batch accepted';
  exception when invalid_parameter_value then null;
  end;
  assert (select total_events=before_count and total_visits=before_visits from public.visitors where id=vid),'atomic rollback';
  payload:=payload||jsonb_build_object('events',(select jsonb_agg(initial->'events'->0) from generate_series(1,41)));
  begin
    perform public.visitor_ingest(payload); raise exception 'batch41 allowed';
  exception when invalid_parameter_value then null;
  end;
  payload:=initial||jsonb_build_object('visitor_id',other,'session_id',gen_random_uuid(),
    'events',jsonb_build_array(jsonb_build_object('id',e1,'name','page_view','occurred_at',t,'page','/')));
  begin
    perform public.visitor_ingest(payload); raise exception 'global event collision allowed';
  exception when raise_exception then if sqlerrm<>'visitor_event_conflict' then raise; end if;
  end;
  assert not exists(select from public.visitors where id=other),'collision rolled back visitor';
  -- Same fingerprint NEVER merges visitors.
  payload:=payload||jsonb_build_object('events',jsonb_build_array(
    jsonb_build_object('id',gen_random_uuid(),'name','page_view','occurred_at',t-interval '60 seconds','page','/')));
  perform public.visitor_ingest(payload);
  assert exists(select from public.visitors where id=other),'fingerprint no merge';
  -- Anonymous history binds once; signup once per account across two opted-in devices.
  result:=public.visitor_link_identity(vid,f.u1,f.account_time,t);
  assert result->>'signup_created'='true','new account signup';
  assert not exists(select from public.visitor_sessions where visitor_id=vid and user_id is distinct from f.u1),'anonymous session binding';
  assert not exists(select from public.visitor_events where visitor_id=vid and user_id is distinct from f.u1),'anonymous event binding';
  assert (select visits_before_signup=2 and pageviews_before_signup=4 from public.visitors where id=vid),'signup snapshot';
  result:=public.visitor_link_identity(vid,f.u1,f.account_time,t);
  assert result->>'signup_created'='false','same identity retry';
  result:=public.visitor_link_identity(other,f.u1,f.account_time,t);
  assert result->>'signup_created'='false','global account signup dedup';
  assert (select count(*)=1 from public.visitor_events where user_id=f.u1 and event_name='signup_completed'),'one signup event';
  result:=public.visitor_link_identity(vid,f.u2,f.account_time,t);
  assert result->>'conflict'='true','different account conflict';
  assert (select user_id=f.u1 and first_attribution->>'utm_source'='first-source' from public.visitors where id=vid),'binding and first acquisition preserved';
  payload:=initial||jsonb_build_object('visitor_id',oldvid,'session_id',gen_random_uuid(),
    'events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','page_view',
      'occurred_at',t,'page','/')));
  perform public.visitor_ingest(payload);
  result:=public.visitor_link_identity(oldvid,f.old_user,f.account_time-interval '1 year',t);
  assert result->>'signup_created'='false','existing account login is not signup';
  -- Global subscription idempotence and latest-device attribution.
  result:=public.visitor_subscription_conversion(f.u1,'sub_VisitorFixture',t);
  assert (result->>'accepted')::int=1,'subscription insert';
  result:=public.visitor_subscription_conversion(f.u1,'sub_VisitorFixture',t);
  assert (result->>'accepted')::int=0,'subscription dedup';
  assert (select count(*)=1 from public.visitor_events where user_id=f.u1 and event_name='subscription_created'),'one subscription event';
  assert (select count(*)=2 from public.visitors where user_id=f.u1 and stripe_subscription_id='sub_VisitorFixture'),'all linked statuses';
  -- Retention removes raw only, never aggregate counts or conversion dedup.
  select total_events,total_pageviews,total_visits,total_duration_seconds,total_engaged_seconds
    into before_count,before_pages,before_visits,before_duration,before_engaged from public.visitors where id=vid;
  update public.visitor_events set received_at=t-interval '91 days' where visitor_id=vid;
  result:=public.visitor_retention(1000);
  assert (result->>'events_deleted')::int>0,'raw retention';
  assert (select total_events=before_count and total_pageviews=before_pages and total_visits=before_visits
    and total_duration_seconds=before_duration and total_engaged_seconds=before_engaged
    from public.visitors where id=vid),'retention totals';
  result:=public.visitor_ingest(retry_batch);
  assert (result->>'accepted')::int=0,'retained receipt dedup';
  result:=public.visitor_link_identity(vid,f.u1,f.account_time,t);
  assert result->>'signup_created'='false','signup durable dedup';
  result:=public.visitor_subscription_conversion(f.u1,'sub_VisitorFixture',t);
  assert (result->>'accepted')::int=0,'subscription durable dedup';
  perform public.visitor_revoke(vid); perform public.visitor_revoke(vid);
  begin
    perform public.visitor_ingest(retry_batch); raise exception 'revoked collect allowed';
  exception when raise_exception then if sqlerrm<>'visitor_revoked' then raise; end if;
  end;
  begin
    perform public.visitor_link_identity(vid,f.u1,f.account_time,t); raise exception 'revoked link allowed';
  exception when raise_exception then if sqlerrm<>'visitor_revoked' then raise; end if;
  end;
  perform public.visitor_revoke(other);
  result:=public.visitor_subscription_conversion(f.u1,'sub_RevokedFixture',t);
  assert (result->>'accepted')::int=0,'revoked subscriptions excluded';
  raise notice 'PASS: ingestion, dedup, atomicity, sessions, acquisition, identity, conversion, revocation, retention';
end;
$$;
-- Contract corrections: independent engagement watermark, verified Auth time,
-- direct-return attribution, lifecycle/page metrics and deleted-account isolation.
do $$
declare
  f record; vid uuid:=gen_random_uuid(); latevid uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid();
  t timestamptz:=clock_timestamp(); payload jsonb; base jsonb; result jsonb; event_list jsonb;
  page_name text; event_name text; stamp timestamptz; current_sid uuid;
begin
  select * into f from visitor_test_fixture;
  base:=jsonb_build_object('visitor_id',vid,'session_id',sid,'has_identity_proof',false,
    'fingerprint',repeat('d',64),'fingerprint_version',1,'fingerprint_confidence',60,
    'fingerprint_updated_at',t,'identity_match_method','new','identity_confidence',0,
    'consent',jsonb_build_object('analytics',true,'version','2026-09-05','updated_at',t),
    'attribution',jsonb_build_object('landing_page','/','utm_source','campaign'),
    'device_profile',jsonb_build_object('device_type','desktop'),
    'events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','page_view',
      'occurred_at',t-interval '30 seconds','page','/')));
  perform public.visitor_ingest(base);
  payload:=base||jsonb_build_object('has_identity_proof',true,'identity_match_method','persistent_id','identity_confidence',100,
    'events',jsonb_build_array(
      jsonb_build_object('id',gen_random_uuid(),'name','cta_click','occurred_at',t-interval '5 seconds','page','/'),
      jsonb_build_object('id',gen_random_uuid(),'name','page_leave','occurred_at',t,'page','/'),
      jsonb_build_object('id',gen_random_uuid(),'name','engagement','occurred_at',t,'page','/',
        'metadata',jsonb_build_object('engaged_seconds',30))));
  perform public.visitor_ingest(payload);
  assert (select total_engaged_seconds=30 and homepage_engaged_seconds=30 and total_duration_seconds=30
    and longest_session_seconds=30 and average_session_seconds=30 from public.visitors where id=vid),'click/page_leave must not consume engagement';
  assert (select last_engagement_at=t and entry_page='/' and exit_page='/' from public.visitor_sessions where id=sid),'session timing/pages';
  payload:=payload||jsonb_build_object('events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),
    'name','engagement','occurred_at',t,'page','/','metadata',jsonb_build_object('engaged_seconds',30))));
  perform public.visitor_ingest(payload);
  assert (select total_engaged_seconds=30 from public.visitors where id=vid),'same timestamp cannot double engagement';
  update public.visitors set fingerprint_updated_at=t-interval '1 day' where id=vid;
  payload:=payload||jsonb_build_object('events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),
    'name','scroll_90','occurred_at',t,'page','/','metadata',jsonb_build_object('scroll_depth',90))));
  perform public.visitor_ingest(payload);
  assert (select max_scroll_depth=90 and homepage_scroll_depth=90 from public.visitor_sessions where id=sid),'homepage scroll milestone metadata';
  payload:=payload||jsonb_build_object('events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),
    'name','scroll_100','occurred_at',t,'page','/pricing','metadata',jsonb_build_object('scroll_depth',100))));
  perform public.visitor_ingest(payload);
  assert (select max_scroll_depth=100 and homepage_scroll_depth=90 from public.visitor_sessions where id=sid),'pricing scroll must not inflate homepage reach';
  assert (select fingerprint_updated_at=t-interval '1 day' from public.visitors where id=vid),'unchanged fingerprint clock';
  payload:=payload||jsonb_build_object('fingerprint',repeat('e',64),'events',jsonb_build_array(
    jsonb_build_object('id',gen_random_uuid(),'name','page_view','occurred_at',t,'page','/pricing')));
  perform public.visitor_ingest(payload);
  assert (select fingerprint_updated_at>=t and first_page='/' and last_page='/pricing' from public.visitors where id=vid),'changed fingerprint/pages';
  -- Genuine return with direct attribution clears latest campaign; original stays.
  update public.visitor_sessions set last_received_at=t-interval '31 minutes' where id=sid;
  payload:=payload||jsonb_build_object('attribution',jsonb_build_object('landing_page','/pricing','utm_source',null,'referrer',null),
    'events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','page_view','occurred_at',t,'page','/pricing')));
  result:=public.visitor_ingest(payload); current_sid:=(result->>'session_id')::uuid;
  assert current_sid<>sid,'direct return session';
  assert (select first_attribution->>'utm_source'='campaign' and not (latest_attribution?'utm_source')
    from public.visitors where id=vid),'direct return must not inherit prior campaign';
  assert (select ended_at is not null from public.visitor_sessions where id=sid),'timeout end timestamp';
  -- Every exact policy path and event is accepted; no guessed or Phase 2 names.
  event_list:='[]';
  foreach event_name in array array['session_start','session_end','page_view','page_leave','engagement','cta_click',
    'navigation_click','scroll_25','scroll_50','scroll_75','scroll_90','scroll_100','form_started','field_focused',
    'form_completed','signup_started','checkout_started'] loop
    event_list:=event_list||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name',event_name,'occurred_at',t,'page','/auth'));
  end loop;
  foreach page_name in array array['/','/pricing','/auth','/privacy-policy','/terms','/acceptable-use-policy',
    '/communications-notice','/data-processing-addendum','/subprocessors','/cookie-notice'] loop
    event_list:=event_list||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','page_view','occurred_at',t,'page',page_name));
  end loop;
  result:=public.visitor_ingest(payload||jsonb_build_object('events',event_list));
  assert (result->>'accepted')::int=27,'exact frontend/backend allowlists';
  foreach page_name in array array['/login','/signup','/features','/sonar','/?token=private'] loop
    begin
      perform public.visitor_ingest(payload||jsonb_build_object('events',jsonb_build_array(
        jsonb_build_object('id',gen_random_uuid(),'name','page_view','occurred_at',t,'page',page_name))));
      raise exception 'nonpublic page accepted';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  foreach event_name in array array['section_view','click','form_start','signup_completed','subscription_created','login'] loop
    begin
      perform public.visitor_ingest(payload||jsonb_build_object('events',jsonb_build_array(
        jsonb_build_object('id',gen_random_uuid(),'name',event_name,'occurred_at',t,'page','/'))));
      raise exception 'nonclient event accepted';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  -- Synthetic delayed verification: account actually created two days ago while
  -- public profile was created today; the verified Auth timestamp wins.
  payload:=base||jsonb_build_object('visitor_id',latevid,'session_id',gen_random_uuid(),
    'events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','page_view','occurred_at',t,'page','/')));
  result:=public.visitor_ingest(payload); current_sid:=(result->>'session_id')::uuid;
  update public.visitors set first_seen_at=t-interval '3 days',last_seen_at=t-interval '3 days' where id=latevid;
  update public.visitor_sessions set started_at=t-interval '3 days',last_seen_at=t-interval '3 days',
    last_engagement_at=t-interval '3 days' where id=current_sid;
  update public.visitor_events set occurred_at=t-interval '3 days' where visitor_id=latevid;
  result:=public.visitor_link_identity(latevid,f.u2,t-interval '2 days',t);
  assert result->>'signup_created'='true' and result->>'login_created'='true','late verified signup and login';
  assert (select signed_up_at=t-interval '2 days' and time_to_signup_seconds=86400
    and visits_before_signup=1 and pageviews_before_signup=1 and signup_snapshot_complete
    from public.visitors where id=latevid),'Auth time and wall time to signup';
  result:=public.visitor_link_identity(latevid,f.u2,t-interval '2 days',t);
  assert result->>'signup_created'='false' and result->>'login_created'='false','per session login dedup';
  delete from public.users where id=f.u2; -- only this transaction's synthetic fixture
  assert (select user_id is null and account_linked_at is not null from public.visitors where id=latevid),'FK deletion preserves binding marker';
  result:=public.visitor_link_identity(latevid,f.u1,f.account_time,t);
  assert result->>'conflict'='true','deleted account must not permit history reassignment';
  assert not exists(select from public.visitor_events where visitor_id=latevid and user_id=f.u1),'no deleted-user crossover';
  -- An idle end arriving at 30m closes its original session without inventing a
  -- new visit. Retry is inert; return at 45m gets a new ID. Page leave stays open.
  vid:=gen_random_uuid(); sid:=gen_random_uuid();
  payload:=base||jsonb_build_object('visitor_id',vid,'session_id',sid,
    'events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','page_view','occurred_at',t,'page','/')));
  perform public.visitor_ingest(payload);
  update public.visitor_sessions set last_received_at=t-interval '31 minutes' where id=sid;
  payload:=payload||jsonb_build_object('has_identity_proof',true,'identity_match_method','persistent_id','identity_confidence',100,
    'events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','session_end','occurred_at',t,'page','/')));
  result:=public.visitor_ingest(payload);
  assert (result->>'session_id')::uuid=sid and (select total_visits=1 from public.visitors where id=vid),'idle end cannot create a visit';
  assert (select ended_at is not null from public.visitor_sessions where id=sid),'explicit idle end closes';
  result:=public.visitor_ingest(payload);
  assert (result->>'accepted')::int=0,'closed end retry';
  payload:=payload||jsonb_build_object('events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','page_view','occurred_at',t,'page','/')));
  result:=public.visitor_ingest(payload); current_sid:=(result->>'session_id')::uuid;
  assert current_sid<>sid and (select total_visits=2 from public.visitors where id=vid),'return after idle end starts new session';
  payload:=payload||jsonb_build_object('session_id',current_sid,'events',jsonb_build_array(
    jsonb_build_object('id',gen_random_uuid(),'name','page_leave','occurred_at',t,'page','/')));
  perform public.visitor_ingest(payload);
  assert (select ended_at is null from public.visitor_sessions where id=current_sid),'pagehide does not close';
  payload:=payload||jsonb_build_object('session_id',gen_random_uuid(),'events',jsonb_build_array(
    jsonb_build_object('id',gen_random_uuid(),'name','session_start','occurred_at',t,'page','/')));
  result:=public.visitor_ingest(payload);
  assert (result->>'session_id')::uuid=current_sid and (select total_visits=2 from public.visitors where id=vid),'refresh preserves active session';
  -- Buffered 60m-old page must remain BEFORE a real signup 45m ago, despite
  -- ingestion now. A duration/session clamp must not rewrite event chronology.
  vid:=gen_random_uuid();
  payload:=base||jsonb_build_object('visitor_id',vid,'session_id',gen_random_uuid(),
    'events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','page_view',
      'occurred_at',t-interval '60 minutes','page','/')));
  result:=public.visitor_ingest(payload); current_sid:=(result->>'session_id')::uuid;
  assert (select occurred_at=t-interval '60 minutes' from public.visitor_events where visitor_id=vid),'buffered event chronology';
  assert (select started_at=t-interval '60 minutes' from public.visitor_sessions where id=current_sid),'buffered session chronology';
  result:=public.visitor_link_identity(vid,f.buffered_user,t-interval '45 minutes',t);
  assert result->>'signup_created'='true','buffered signup';
  assert (select visits_before_signup=1 and pageviews_before_signup=1 and time_to_signup_seconds=900
    from public.visitors where id=vid),'buffered pre-signup snapshot';
  -- Stripe floors created to seconds: visitor at xx:xx:20.5 still matches paid
  -- event xx:xx:20. Keep every stored conversion timestamp >= first_seen_at.
  perform public.visitor_revoke(vid);
  vid:=gen_random_uuid(); stamp:=date_trunc('second',t)-interval '2 seconds';
  payload:=base||jsonb_build_object('visitor_id',vid,'session_id',gen_random_uuid(),
    'events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','page_view',
      'occurred_at',stamp+interval '0.5 seconds','page','/')));
  perform public.visitor_ingest(payload);
  perform public.visitor_link_identity(vid,f.buffered_user,t-interval '45 minutes',t);
  result:=public.visitor_subscription_conversion(f.buffered_user,'sub_PrecisionFixture',stamp);
  assert (result->>'accepted')::int=1 and (result->>'visitor_id')::uuid=vid,'whole-second Stripe precision match';
  assert (select occurred_at=stamp+interval '0.5 seconds' from public.visitor_events
    where conversion_key='subscription:sub_PrecisionFixture'),'paid event timestamp cannot predate visitor';
  assert (select occurred_at=stamp+interval '0.5 seconds' from visitor_private.conversion_claims
    where conversion_key='subscription:sub_PrecisionFixture'),'paid receipt timestamp clamp';
  assert (select subscribed_at=first_seen_at from public.visitors where id=vid),'subscription timestamp clamp';
  result:=public.visitor_subscription_conversion(f.buffered_user,'sub_PrecisionFixture',stamp);
  assert (result->>'accepted')::int=0,'precision conversion retry remains idempotent';
  result:=public.visitor_subscription_conversion(f.buffered_user,'sub_PrecisionBoundary',stamp-interval '0.5 seconds');
  assert (result->>'accepted')::int=0,'precision tolerance excludes exact one-second gap';
  raise notice 'PASS: exact policy contract, engagement watermark, lifecycle metrics, Auth timestamps, delayed signup, login and deleted-account isolation';
end;
$$;
reset role;

-- ACL assertions cover every new table/function including private durable receipts.
do $$
declare r record; role_name text; privilege_name text;
begin
  for r in select c.oid,n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where (n.nspname='public' and c.relname in ('visitors','visitor_sessions','visitor_events'))
       or (n.nspname='visitor_private' and c.relkind='r') loop
    assert r.relrowsecurity and r.relforcerowsecurity,'ENABLE/FORCE RLS';
    assert not exists(select from pg_policy where polrelid=r.oid),'no customer policies';
    foreach role_name in array array['anon','authenticated'] loop
      foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        assert not has_table_privilege(role_name,r.oid,privilege_name),'client ACL';
      end loop;
    end loop;
    assert has_table_privilege('service_role',r.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'service table grant';
  end loop;
  for r in select oid,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace
    and proname in ('visitor_ingest','visitor_link_identity','visitor_subscription_conversion','visitor_revoke','visitor_retention') loop
    assert not r.prosecdef and r.proconfig @> array['search_path=pg_catalog, public, visitor_private'],'invoker/fixed path';
    assert not has_function_privilege('anon',r.oid,'EXECUTE') and not has_function_privilege('authenticated',r.oid,'EXECUTE'),'client RPC ACL';
    assert has_function_privilege('service_role',r.oid,'EXECUTE'),'service RPC grant';
  end loop;
end;
$$;
set local role anon;
do $$
begin
  begin perform 1 from public.visitors; raise exception 'anon SELECT allowed'; exception when insufficient_privilege then null; end;
  begin perform public.visitor_ingest('{}'); raise exception 'anon RPC allowed'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role authenticated;
do $$
begin
  begin perform 1 from public.visitor_events; raise exception 'authenticated SELECT allowed'; exception when insufficient_privilege then null; end;
  begin perform public.visitor_revoke(gen_random_uuid()); raise exception 'authenticated RPC allowed'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
-- Defense in depth: even accidental future DML grants expose zero rows/no inserts.
grant select,insert,update,delete on public.visitors to anon,authenticated;
set local role authenticated;
do $$
begin
  assert (select count(*)=0 from public.visitors),'RLS must hide all rows';
  begin
    insert into public.visitors(id) values(gen_random_uuid());
    raise exception 'RLS INSERT allowed';
  exception when insufficient_privilege then null;
  end;
  update public.visitors set revoked_at=clock_timestamp();
  assert not found,'RLS UPDATE must affect zero';
  delete from public.visitors;
  assert not found,'RLS DELETE must affect zero';
  raise notice 'PASS: anonymous/authenticated denied by ACL and RLS, service-only invoker RPCs';
end;
$$;
reset role;
rollback;
