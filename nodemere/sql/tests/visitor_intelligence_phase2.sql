-- Run after both Visitor Intelligence migrations. Every fixture rolls back.
begin;
set local statement_timeout='30s';
set local role service_role;

do $$
declare
  vid uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); other_vid uuid:=gen_random_uuid();
  t timestamptz:=clock_timestamp()-interval '20 minutes';
  payload jsonb; retry jsonb; result jsonb; before_views bigint;
begin
  payload:=jsonb_build_object(
    'visitor_id',vid,'session_id',sid,'has_identity_proof',false,
    'fingerprint',repeat('a',64),'fingerprint_version',1,'fingerprint_confidence',60,
    'identity_match_method','new','identity_confidence',0,
    'consent',jsonb_build_object('analytics',true,'version','2026-09-05','updated_at',t),
    'attribution',jsonb_build_object('landing_page','/','utm_source','phase2'),
    'device_profile',jsonb_build_object('browser','chrome','device_type','desktop','viewport_width',1280,'viewport_height',800),
    'is_bot',false,'is_internal',false,
    'events',jsonb_build_array(
      jsonb_build_object('id',gen_random_uuid(),'name','page_view','occurred_at',t,'page','/','metadata','{}'::jsonb),
      jsonb_build_object('id',gen_random_uuid(),'name','section_view','occurred_at',t+interval '1 second','page','/','metadata',
        jsonb_build_object('section_id','hero','section_index',0,'device_class','desktop','viewport_width',1280,'viewport_height',800)),
      jsonb_build_object('id',gen_random_uuid(),'name','homepage_click','occurred_at',t+interval '2 seconds','page','/','metadata',
        jsonb_build_object('section_id','hero','section_index',0,'element_id','hero-surface','element_type','other','device_class','desktop',
          'viewport_width',1280,'viewport_height',800,'normalized_x',0.25,'normalized_y',0.5)),
      jsonb_build_object('id',gen_random_uuid(),'name','section_view','occurred_at',t+interval '3 seconds','page','/','metadata',
        jsonb_build_object('section_id','calendar','section_index',1,'device_class','desktop','viewport_width',1280,'viewport_height',800)),
      jsonb_build_object('id',gen_random_uuid(),'name','section_progression','occurred_at',t+interval '4 seconds','page','/','metadata',
        jsonb_build_object('from_section_id','hero','from_section_index',0,'to_section_id','calendar','to_section_index',1,
          'device_class','desktop','viewport_width',1280,'viewport_height',800)),
      jsonb_build_object('id',gen_random_uuid(),'name','cta_click','occurred_at',t+interval '5 seconds','page','/','metadata',
        jsonb_build_object('section_id','calendar','section_index',1,'element_id','calendar-booking-calls','element_type','link','device_class','desktop',
          'viewport_width',1280,'viewport_height',800,'normalized_x',0.75,'normalized_y',0.25,'href','/auth')),
      jsonb_build_object('id',gen_random_uuid(),'name','section_attention','occurred_at',t+interval '6 seconds','page','/','metadata',
        jsonb_build_object('section_id','hero','section_index',0,'device_class','desktop','viewport_width',1280,'viewport_height',800,
          'visible_seconds',12,'continued',true,'deepest_section_id','calendar','deepest_section_index',1)),
      jsonb_build_object('id',gen_random_uuid(),'name','section_attention','occurred_at',t+interval '6 seconds','page','/','metadata',
        jsonb_build_object('section_id','calendar','section_index',1,'device_class','desktop','viewport_width',1280,'viewport_height',800,
          'visible_seconds',18,'continued',false,'deepest_section_id','calendar','deepest_section_index',1))
    ));
  result:=public.visitor_ingest_phase2(payload);
  assert (result->>'accepted')::integer=8,'phase2 batch accepted';
  assert (select homepage_deepest_section_id='calendar' and homepage_deepest_section_index=1 and homepage_section_views=2
    from public.visitor_sessions where id=(result->>'session_id')::uuid),'deepest meaningful section';
  assert (select unique_visitors=1 and total_views=1 and visible_seconds_sum=12 and visible_samples=1
    and clicks=1 and cta_clicks=0 and continuations=1 and dropoffs=0
    from public.homepage_section_hourly where bucket_start=date_trunc('hour',t) and section_id='hero'),'hero rollup';
  assert (select unique_visitors=1 and total_views=1 and visible_seconds_sum=18 and visible_samples=1
    and clicks=1 and cta_clicks=1 and continuations=0 and dropoffs=1
    from public.homepage_section_daily where bucket_date=(t at time zone 'UTC')::date and section_id='calendar'),'calendar rollup';
  assert (select clicks=1 and x_cell=5 and y_cell=10 and viewport_bucket='desktop'
    from public.homepage_click_hourly where section_id='hero' and element_id='hero-surface'),'heatmap grid';
  assert (select transitions=1 from public.homepage_flow_hourly where from_section_id='hero' and to_section_id='calendar'),'flow edge';
  assert (select reach_rate=100 and continuation_rate=100 and dropoff_rate=0 and median_visible_seconds=15
    and engagement_score>0 and not is_major_dropoff
    from visitor_private.homepage_section_daily_metrics where bucket_date=(t at time zone 'UTC')::date and section_id='hero'),'calculated hero metrics';
  assert (select continuation_rate=0 and dropoff_rate=100 and is_major_dropoff
    from visitor_private.homepage_section_daily_metrics where bucket_date=(t at time zone 'UTC')::date and section_id='calendar'),'major dropoff calculation';

  retry:=payload||jsonb_build_object('has_identity_proof',true,'identity_match_method','persistent_id','identity_confidence',100);
  result:=public.visitor_ingest_phase2(retry);
  assert (result->>'accepted')::integer=0,'retry accepted no events';
  assert (select total_views=1 and clicks=1 from public.homepage_section_hourly where section_id='hero'),'retry did not duplicate rollups';

  retry:=jsonb_set(retry,'{events}',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','section_view',
    'occurred_at',t+interval '7 seconds','page','/','metadata',jsonb_build_object('section_id','hero','section_index',0,
      'device_class','desktop','viewport_width',1280,'viewport_height',800))));
  perform public.visitor_ingest_phase2(retry);
  assert (select unique_visitors=1 and total_views=2 from public.homepage_section_daily where section_id='hero'),'daily unique visitor claim';

  payload:=jsonb_set(payload,'{visitor_id}',to_jsonb(other_vid));
  payload:=jsonb_set(payload,'{session_id}',to_jsonb(gen_random_uuid()));
  payload:=jsonb_set(payload,'{fingerprint}',to_jsonb(repeat('b',64)));
  payload:=jsonb_set(payload,'{events}',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','section_view',
    'occurred_at',t+interval '8 seconds','page','/','metadata',jsonb_build_object('section_id','hero','section_index',0,
      'device_class','desktop','viewport_width',1280,'viewport_height',800))));
  perform public.visitor_ingest_phase2(payload);
  assert (select unique_visitors=2 and total_views=3 from public.homepage_section_daily where section_id='hero'),'second visitor reach';

  select total_views into before_views from public.homepage_section_daily where section_id='hero';
  payload:=jsonb_set(payload,'{visitor_id}',to_jsonb(gen_random_uuid()));
  payload:=jsonb_set(payload,'{session_id}',to_jsonb(gen_random_uuid()));
  payload:=jsonb_set(payload,'{fingerprint}',to_jsonb(repeat('c',64)));
  payload:=jsonb_set(payload,'{is_bot}','true'::jsonb);
  payload:=jsonb_set(payload,'{events,0,id}',to_jsonb(gen_random_uuid()));
  perform public.visitor_ingest_phase2(payload);
  assert (select total_views=before_views from public.homepage_section_daily where section_id='hero'),'bots excluded from rollups';

  payload:=jsonb_set(payload,'{events,0,metadata,section_id}',to_jsonb('invented'::text));
  begin
    perform public.visitor_ingest_phase2(payload);
    raise exception 'invalid section accepted';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

reset role;
do $$
declare table_name text;
begin
  foreach table_name in array array['homepage_section_hourly','homepage_section_daily','homepage_click_hourly',
    'homepage_click_daily','homepage_flow_hourly','homepage_flow_daily'] loop
    assert not has_table_privilege('anon','public.'||table_name,'SELECT'),'anon rollup read';
    assert not has_table_privilege('authenticated','public.'||table_name,'SELECT'),'authenticated rollup read';
  end loop;
  assert not has_function_privilege('anon','public.visitor_ingest_phase2(jsonb)','EXECUTE'),'anon phase2 execute';
  assert not has_function_privilege('authenticated','public.visitor_ingest_phase2(jsonb)','EXECUTE'),'authenticated phase2 execute';
  assert (select bool_and(relrowsecurity and relforcerowsecurity) from pg_class
    where oid in ('public.homepage_section_hourly'::regclass,'public.homepage_section_daily'::regclass,
      'public.homepage_click_hourly'::regclass,'public.homepage_click_daily'::regclass,
      'public.homepage_flow_hourly'::regclass,'public.homepage_flow_daily'::regclass,
      'visitor_private.homepage_section_hourly_visitors'::regclass,
      'visitor_private.homepage_section_daily_visitors'::regclass)),'phase2 forced RLS';
end;
$$;

set local role authenticated;
do $$ begin
  begin perform * from public.homepage_section_daily; raise exception 'authenticated read succeeded';
  exception when insufficient_privilege then null; end;
  begin perform public.visitor_ingest_phase2('{}'::jsonb); raise exception 'authenticated execute succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
