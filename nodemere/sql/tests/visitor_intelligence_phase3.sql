-- Run after all three Visitor Intelligence migrations. Every fixture rolls back.
begin;
set local statement_timeout='30s';
set local role service_role;

do $$
declare
  vid uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); t timestamptz:=clock_timestamp()-interval '10 minutes';
  payload jsonb; center jsonb; listing jsonb; profile jsonb; pulse jsonb;
begin
  payload:=jsonb_build_object(
    'visitor_id',vid,'session_id',sid,'has_identity_proof',false,
    'fingerprint',repeat('d',64),'fingerprint_version',1,'fingerprint_confidence',60,
    'identity_match_method','new','identity_confidence',0,
    'consent',jsonb_build_object('analytics',true,'version','2026-09-05','updated_at',t),
    'attribution',jsonb_build_object('landing_page','/','utm_source','phase3-source','utm_campaign','phase3-campaign'),
    'device_profile',jsonb_build_object('browser','chrome','os','windows','device_type','desktop','viewport_width',1440,'viewport_height',900),
    'is_bot',false,'is_internal',false,
    'events',jsonb_build_array(
      jsonb_build_object('id',gen_random_uuid(),'name','page_view','occurred_at',t,'page','/','metadata','{}'::jsonb),
      jsonb_build_object('id',gen_random_uuid(),'name','section_view','occurred_at',t+interval '1 second','page','/','metadata',
        jsonb_build_object('section_id','hero','section_index',0,'device_class','desktop','viewport_width',1440,'viewport_height',900)),
      jsonb_build_object('id',gen_random_uuid(),'name','homepage_click','occurred_at',t+interval '2 seconds','page','/','metadata',
        jsonb_build_object('section_id','hero','section_index',0,'element_id','hero-primary','element_type','button','device_class','desktop',
          'viewport_width',1440,'viewport_height',900,'normalized_x',0.5,'normalized_y',0.75)),
      jsonb_build_object('id',gen_random_uuid(),'name','section_view','occurred_at',t+interval '3 seconds','page','/','metadata',
        jsonb_build_object('section_id','calendar','section_index',1,'device_class','desktop','viewport_width',1440,'viewport_height',900)),
      jsonb_build_object('id',gen_random_uuid(),'name','section_progression','occurred_at',t+interval '4 seconds','page','/','metadata',
        jsonb_build_object('from_section_id','hero','from_section_index',0,'to_section_id','calendar','to_section_index',1,'device_class','desktop','viewport_width',1440,'viewport_height',900)),
      jsonb_build_object('id',gen_random_uuid(),'name','section_attention','occurred_at',t+interval '5 seconds','page','/','metadata',
        jsonb_build_object('section_id','hero','section_index',0,'device_class','desktop','viewport_width',1440,'viewport_height',900,
          'visible_seconds',20,'continued',true,'deepest_section_id','calendar','deepest_section_index',1)),
      jsonb_build_object('id',gen_random_uuid(),'name','section_attention','occurred_at',t+interval '6 seconds','page','/','metadata',
        jsonb_build_object('section_id','calendar','section_index',1,'device_class','desktop','viewport_width',1440,'viewport_height',900,
          'visible_seconds',12,'continued',false,'deepest_section_id','calendar','deepest_section_index',1))
    )
  );
  perform public.visitor_ingest_phase2(payload);

  center:=public.visitor_intelligence_command_center(t-interval '1 minute',clock_timestamp(),null,null,null,null,null,null,false);
  assert (center#>>'{overview,visitors}')::integer=1,'center visitor count';
  assert center#>>'{overview,top_source}'='phase3-source','center source';
  assert jsonb_array_length(center#>'{homepage,sections}')=7,'all homepage sections returned';
  assert (select (item->>'unique_visitors')::integer=1 and (item->>'continuation_rate')::numeric=100
    from jsonb_array_elements(center#>'{homepage,sections}') item where item->>'id'='hero'),'hero metrics';
  assert (center#>>'{homepage,clicks,0,element_id}')='hero-primary','click cluster';
  assert (center#>>'{homepage,clicks,0,click_through_rate}')::numeric=100,'click-through rate';
  assert (center#>>'{homepage,clicks,0,conversion_rate}')::numeric=0,'click conversion rate';
  assert (center#>>'{homepage,flow,0,from}')='hero' and (center#>>'{homepage,flow,0,to}')='calendar','flow metrics';
  assert center#>>'{deep,geography,available}'='false','no fabricated geography';

  listing:=public.visitor_intelligence_visitors(t-interval '1 minute',clock_timestamp(),1,25,null,'last_seen_desc','desktop','anonymous','phase3-source','phase3-campaign','calendar',false);
  assert (listing->>'total')::integer=1 and (listing#>>'{items,0,visitor_id}')::uuid=vid,'filtered visitor list';
  assert listing#>>'{items,0,deepest_section_id}'='calendar','visitor section depth';

  profile:=public.visitor_intelligence_profile(vid,false);
  assert (profile#>>'{identity,id}')::uuid=vid and jsonb_array_length(profile->'timeline')=7,'bounded profile history';
  assert profile#>>'{location,available}'='false','profile location unavailable';

  pulse:=public.visitor_intelligence_activity(t-interval '1 minute',30,false);
  assert jsonb_array_length(pulse)=7 and (pulse#>>'{0,visitor_id}')::uuid=vid,'recent visitor pulse';
end;
$$;

reset role;
do $$ begin
  assert not has_function_privilege('anon','public.visitor_intelligence_command_center(timestamptz,timestamptz,text,text,boolean,text,text,text,boolean)','EXECUTE'),'anon command center execute';
  assert not has_function_privilege('authenticated','public.visitor_intelligence_visitors(timestamptz,timestamptz,integer,integer,text,text,text,text,text,text,text,boolean)','EXECUTE'),'authenticated visitor list execute';
  assert not has_function_privilege('authenticated','public.visitor_intelligence_profile(uuid,boolean)','EXECUTE'),'authenticated profile execute';
  assert not has_function_privilege('anon','public.visitor_intelligence_activity(timestamptz,integer,boolean)','EXECUTE'),'anon activity execute';
end $$;

set local role authenticated;
do $$ begin
  begin perform public.visitor_intelligence_activity(null,10,false); raise exception 'authenticated activity succeeded';
  exception when insufficient_privilege then null; end;
  begin perform public.visitor_intelligence_profile(gen_random_uuid(),false); raise exception 'authenticated profile succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
