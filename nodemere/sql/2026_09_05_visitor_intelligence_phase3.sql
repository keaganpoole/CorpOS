-- Visitor Intelligence Phase 3: service-only command-center read models.
-- Run after the Phase 1 and Phase 2 migrations as database owner.

begin;

-- Replace the original two-phase read-model overloads so PostgREST cannot
-- resolve an ambiguous function name after the local-only visibility flag is
-- added.
drop function if exists public.visitor_intelligence_command_center(timestamptz,timestamptz,text,text,boolean,text,text,text);
drop function if exists public.visitor_intelligence_visitors(timestamptz,timestamptz,integer,integer,text,text,text,text,text,text,text);
drop function if exists public.visitor_intelligence_profile(uuid);
drop function if exists public.visitor_intelligence_activity(timestamptz,integer);

create index if not exists visitor_sessions_intelligence_range
  on public.visitor_sessions(started_at desc, visitor_id);
create index if not exists visitor_events_intelligence_range
  on public.visitor_events(occurred_at desc, event_name, session_id);
create index if not exists visitors_intelligence_status
  on public.visitors(last_seen_at desc, total_visits, user_id)
  where revoked_at is null and not is_bot and not is_internal;

create or replace function public.visitor_intelligence_command_center(
  p_start timestamptz,
  p_end timestamptz,
  p_device text default null,
  p_segment text default null,
  p_converted boolean default null,
  p_source text default null,
  p_campaign text default null,
  p_section text default null,
  p_include_internal boolean default false
) returns jsonb
language plpgsql security invoker
set search_path=pg_catalog,public,visitor_private
as $$
declare result jsonb;
begin
  if p_start is null or p_end is null or p_start>=p_end or p_end>clock_timestamp()+interval '5 minutes'
    or p_device is not null and p_device<>all(array['desktop','tablet','mobile','unknown'])
    or p_segment is not null and p_segment<>all(array['new','returning'])
    or p_source is not null and length(p_source)>100
    or p_campaign is not null and length(p_campaign)>100
    or p_section is not null and visitor_private.homepage_section_index(p_section) is null then
    raise exception using errcode='22023',message='visitor_intelligence_invalid_filter';
  end if;

  with session_scope as materialized (
    select s.id,s.visitor_id,s.started_at,s.last_seen_at,s.ended_at,s.entry_page,s.exit_page,
      s.pageview_count,s.duration_seconds,s.engaged_seconds,s.homepage_engaged_seconds,
      s.max_scroll_depth,s.homepage_scroll_depth,s.homepage_deepest_section_id,
      s.homepage_deepest_section_index,s.homepage_section_views,s.device_profile,
      coalesce(nullif(s.first_attribution->>'utm_source',''),nullif(s.first_attribution->>'referrer',''),'Direct') source,
      coalesce(nullif(s.first_attribution->>'utm_campaign',''),'Unattributed') campaign,
      nullif(s.first_attribution->>'referrer','') referrer,
      case when v.total_visits>1 then 'returning' else 'new' end visitor_segment,
      (v.signed_up_at is not null or v.subscribed_at is not null) converted,
      v.first_seen_at,v.signed_up_at,v.subscribed_at,v.visits_before_signup,v.time_to_signup_seconds
    from public.visitor_sessions s
    join public.visitors v on v.id=s.visitor_id
    where s.started_at>=p_start and s.started_at<p_end
      and v.revoked_at is null and not v.is_bot and (p_include_internal or not v.is_internal)
      and (p_device is null or coalesce(s.device_profile->>'device_type','unknown')=p_device)
      and (p_segment is null or (case when v.total_visits>1 then 'returning' else 'new' end)=p_segment)
      and (p_converted is null or (v.signed_up_at is not null or v.subscribed_at is not null)=p_converted)
      and (p_source is null or coalesce(nullif(s.first_attribution->>'utm_source',''),nullif(s.first_attribution->>'referrer',''),'Direct')=p_source)
      and (p_campaign is null or coalesce(nullif(s.first_attribution->>'utm_campaign',''),'Unattributed')=p_campaign)
  ),
  visitor_scope as materialized (
    select distinct visitor_id,visitor_segment,converted,first_seen_at,signed_up_at,subscribed_at,
      visits_before_signup,time_to_signup_seconds from session_scope
  ),
  event_scope as materialized (
    select e.id,e.visitor_id,e.session_id,e.event_name,e.occurred_at,e.page,e.metadata,
      ss.visitor_segment,ss.converted
    from public.visitor_events e join session_scope ss on ss.id=e.session_id
    where e.occurred_at>=p_start and e.occurred_at<p_end
      and (p_section is null or e.metadata->>'section_id'=p_section
        or e.metadata->>'from_section_id'=p_section or e.metadata->>'to_section_id'=p_section)
  ),
  summary as (
    select count(distinct visitor_id)::bigint visitors,count(*)::bigint sessions,
      coalesce(sum(pageview_count),0)::bigint pageviews,
      coalesce(avg(duration_seconds),0)::numeric avg_session_seconds,
      coalesce(avg(engaged_seconds),0)::numeric avg_engaged_seconds,
      coalesce(avg(max_scroll_depth),0)::numeric avg_scroll_depth,
      coalesce(100.0*count(*) filter(where homepage_scroll_depth>=90)/nullif(count(*),0),0)::numeric completion_rate
    from session_scope
  ),
  conversion_summary as (
    select count(*) filter(where signed_up_at>=p_start and signed_up_at<p_end)::bigint signups,
      count(*) filter(where subscribed_at>=p_start and subscribed_at<p_end)::bigint paid,
      coalesce(avg(visits_before_signup) filter(where signed_up_at>=p_start and signed_up_at<p_end),0)::numeric avg_visits_before_signup,
      coalesce(avg(time_to_signup_seconds) filter(where signed_up_at>=p_start and signed_up_at<p_end),0)::numeric avg_time_to_signup_seconds
    from visitor_scope
  ),
  section_catalog(section_id,section_index,label) as (values
    ('hero',0,'Hero'),('calendar',1,'Calendar'),('people-crm',2,'People & CRM'),
    ('live-monitoring',3,'Live Monitoring'),('comparison',4,'Comparison'),
    ('scenarios',5,'Scenarios'),('security',6,'Security')
  ),
  section_raw as (
    select c.section_id,c.section_index,c.label,
      count(distinct e.visitor_id) filter(where e.event_name='section_view')::bigint unique_visitors,
      count(*) filter(where e.event_name='section_view')::bigint views,
      coalesce(sum((e.metadata->>'visible_seconds')::numeric) filter(where e.event_name='section_attention'),0)::numeric visible_seconds,
      count(*) filter(where e.event_name='section_attention')::bigint attention_samples,
      count(*) filter(where e.event_name='section_attention' and (e.metadata->>'continued')::boolean)::bigint continuations,
      count(*) filter(where e.event_name='section_attention' and not (e.metadata->>'continued')::boolean)::bigint dropoffs,
      count(*) filter(where e.event_name in ('homepage_click','cta_click','navigation_click'))::bigint clicks,
      count(*) filter(where e.event_name='cta_click')::bigint cta_clicks,
      count(distinct e.visitor_id) filter(where e.event_name='section_view' and e.visitor_segment='new')::bigint new_visitors,
      count(distinct e.visitor_id) filter(where e.event_name='section_view' and e.visitor_segment='returning')::bigint returning_visitors,
      count(distinct e.visitor_id) filter(where e.event_name='section_view' and e.converted)::bigint converted_visitors
    from section_catalog c
    left join event_scope e on e.metadata->>'section_id'=c.section_id
    group by c.section_id,c.section_index,c.label
  ),
  section_metrics as (
    select r.*,
      coalesce(100.0*r.unique_visitors/nullif(max(r.unique_visitors) filter(where r.section_id='hero') over(),0),0)::numeric reach_rate,
      coalesce(r.visible_seconds/nullif(r.attention_samples,0),0)::numeric avg_visible_seconds,
      coalesce(100.0*r.continuations/nullif(r.attention_samples,0),0)::numeric continuation_rate,
      coalesce(100.0*r.dropoffs/nullif(r.attention_samples,0),0)::numeric dropoff_rate,
      coalesce(100.0*r.clicks/nullif(r.unique_visitors,0),0)::numeric click_rate,
      least(100,coalesce(45.0*r.unique_visitors/nullif(max(r.unique_visitors) filter(where r.section_id='hero') over(),0),0)
        +least(25,coalesce(25.0*(r.visible_seconds/nullif(r.attention_samples,0))/30,0))
        +coalesce(20.0*r.continuations/nullif(r.attention_samples,0),0)
        +least(10,coalesce(5.0*r.views/nullif(r.unique_visitors,0),0)))::numeric attention_score
    from section_raw r
  ),
  click_metrics as (
    select e.metadata->>'section_id' section_id,e.metadata->>'element_id' element_id,
      e.metadata->>'element_type' element_type,
      least(19,floor((e.metadata->>'normalized_x')::numeric*20))::integer x_cell,
      least(19,floor((e.metadata->>'normalized_y')::numeric*20))::integer y_cell,
      count(*)::bigint clicks,count(*) filter(where e.event_name='cta_click')::bigint cta_clicks,
      count(distinct e.visitor_id)::bigint unique_visitors,
      count(distinct e.visitor_id) filter(where e.converted)::bigint converted_visitors
    from event_scope e
    where e.event_name in ('homepage_click','cta_click','navigation_click')
      and e.metadata ? 'section_id' and e.metadata ? 'normalized_x' and e.metadata ? 'normalized_y'
    group by 1,2,3,4,5
  ),
  flow_metrics as (
    select e.metadata->>'from_section_id' from_section,e.metadata->>'to_section_id' to_section,
      count(*)::bigint transitions
    from event_scope e where e.event_name='section_progression'
    group by 1,2
  ),
  source_metrics as (
    select source,count(distinct visitor_id)::bigint visitors,count(*)::bigint sessions,
      coalesce(sum(pageview_count),0)::bigint pageviews from session_scope group by source order by visitors desc,source limit 12
  ),
  campaign_metrics as (
    select campaign,count(distinct visitor_id)::bigint visitors,count(*)::bigint sessions
    from session_scope group by campaign order by visitors desc,campaign limit 12
  ),
  referrer_metrics as (
    select coalesce(referrer,'Direct') referrer,count(distinct visitor_id)::bigint visitors
    from session_scope group by coalesce(referrer,'Direct') order by visitors desc,referrer limit 12
  ),
  device_metrics as (
    select coalesce(device_profile->>'device_type','unknown') device,count(distinct visitor_id)::bigint visitors,
      count(*)::bigint sessions,coalesce(avg(engaged_seconds),0)::numeric avg_engaged_seconds
    from session_scope group by 1 order by visitors desc,device
  ),
  browser_metrics as (
    select coalesce(device_profile->>'browser','unknown') browser,count(distinct visitor_id)::bigint visitors
    from session_scope group by 1 order by visitors desc,browser
  ),
  page_metrics as (
    select coalesce(page,'Unknown') page,count(*) filter(where event_name='page_view')::bigint pageviews,
      count(distinct visitor_id)::bigint visitors
    from event_scope where event_name='page_view' group by page order by pageviews desc,page limit 12
  ),
  comparison_metrics as (
    select visitor_segment segment,count(distinct visitor_id)::bigint visitors,count(*)::bigint sessions,
      coalesce(avg(engaged_seconds),0)::numeric avg_engaged_seconds,
      coalesce(avg(homepage_scroll_depth),0)::numeric avg_scroll_depth,
      count(distinct visitor_id) filter(where converted)::bigint converted
    from session_scope group by visitor_segment
  )
  select jsonb_build_object(
    'generated_at',clock_timestamp(),
    'overview',jsonb_build_object(
      'visitors',(select visitors from summary),
      'visitors_today',(select count(distinct s.visitor_id) from public.visitor_sessions s join public.visitors v on v.id=s.visitor_id where s.started_at>=date_trunc('day',clock_timestamp()) and v.revoked_at is null and not v.is_bot and (p_include_internal or not v.is_internal)),
      'visitors_week',(select count(distinct s.visitor_id) from public.visitor_sessions s join public.visitors v on v.id=s.visitor_id where s.started_at>=clock_timestamp()-interval '7 days' and v.revoked_at is null and not v.is_bot and (p_include_internal or not v.is_internal)),
      'visitors_month',(select count(distinct s.visitor_id) from public.visitor_sessions s join public.visitors v on v.id=s.visitor_id where s.started_at>=clock_timestamp()-interval '30 days' and v.revoked_at is null and not v.is_bot and (p_include_internal or not v.is_internal)),
      'new_visitors',(select count(*) from visitor_scope where visitor_segment='new'),
      'returning_visitors',(select count(*) from visitor_scope where visitor_segment='returning'),
      'sessions',(select sessions from summary),'pageviews',(select pageviews from summary),
      'avg_session_seconds',(select avg_session_seconds from summary),
      'avg_engaged_seconds',(select avg_engaged_seconds from summary),
      'avg_scroll_depth',(select avg_scroll_depth from summary),
      'completion_rate',(select completion_rate from summary),
      'signup_conversions',(select signups from conversion_summary),
      'paid_conversions',(select paid from conversion_summary),
      'conversion_rate',coalesce(100.0*(select signups from conversion_summary)/nullif((select visitors from summary),0),0),
      'avg_visits_before_signup',(select avg_visits_before_signup from conversion_summary),
      'avg_time_to_signup_seconds',(select avg_time_to_signup_seconds from conversion_summary),
      'top_source',(select source from source_metrics limit 1),
      'top_campaign',(select campaign from campaign_metrics limit 1),
      'top_referrer',(select referrer from referrer_metrics limit 1),
      'top_device',(select device from device_metrics limit 1),
      'top_browser',(select browser from browser_metrics limit 1),
      'top_location','Not available'
    ),
    'homepage',jsonb_build_object(
      'sections',coalesce((select jsonb_agg(jsonb_build_object(
        'id',section_id,'index',section_index,'label',label,'unique_visitors',unique_visitors,'views',views,
        'visible_seconds',visible_seconds,'average_visible_seconds',avg_visible_seconds,'continuations',continuations,
        'dropoffs',dropoffs,'reach_rate',reach_rate,'continuation_rate',continuation_rate,'dropoff_rate',dropoff_rate,
        'clicks',clicks,'cta_clicks',cta_clicks,'click_rate',click_rate,'new_visitors',new_visitors,
        'returning_visitors',returning_visitors,'converted_visitors',converted_visitors,'attention_score',attention_score,
        'attention_state',case when attention_score>=70 then 'Hot' when attention_score>=45 then 'Warm' when attention_score>=20 then 'Cool' else 'Dormant' end
      ) order by section_index) from section_metrics),'[]'::jsonb),
      'clicks',coalesce((select jsonb_agg(jsonb_build_object(
        'section_id',c.section_id,'element_id',c.element_id,'element_type',c.element_type,
        'x',(c.x_cell+.5)/20.0,'y',(c.y_cell+.5)/20.0,'clicks',c.clicks,'cta_clicks',c.cta_clicks,
        'unique_visitors',c.unique_visitors,'converted_visitors',c.converted_visitors,
        'click_through_rate',coalesce(100.0*c.unique_visitors/nullif(s.unique_visitors,0),0),
        'conversion_rate',coalesce(100.0*c.converted_visitors/nullif(c.unique_visitors,0),0)
      ) order by c.clicks desc,c.section_id,c.element_id) from click_metrics c left join section_metrics s on s.section_id=c.section_id),'[]'::jsonb),
      'flow',coalesce((select jsonb_agg(jsonb_build_object('from',from_section,'to',to_section,'transitions',transitions)
        order by transitions desc,from_section,to_section) from flow_metrics),'[]'::jsonb)
    ),
    'deep',jsonb_build_object(
      'acquisition',jsonb_build_object(
        'sources',coalesce((select jsonb_agg(to_jsonb(source_metrics) order by visitors desc,source) from source_metrics),'[]'::jsonb),
        'campaigns',coalesce((select jsonb_agg(to_jsonb(campaign_metrics) order by visitors desc,campaign) from campaign_metrics),'[]'::jsonb),
        'referrers',coalesce((select jsonb_agg(to_jsonb(referrer_metrics) order by visitors desc,referrer) from referrer_metrics),'[]'::jsonb)),
      'behavior',jsonb_build_object('pages',coalesce((select jsonb_agg(to_jsonb(page_metrics) order by pageviews desc,page) from page_metrics),'[]'::jsonb)),
      'engagement',jsonb_build_object('average_scroll_depth',(select avg_scroll_depth from summary),'completion_rate',(select completion_rate from summary)),
      'conversion',jsonb_build_object('signups',(select signups from conversion_summary),'paid',(select paid from conversion_summary),'rate',coalesce(100.0*(select signups from conversion_summary)/nullif((select visitors from summary),0),0)),
      'devices',jsonb_build_object(
        'devices',coalesce((select jsonb_agg(to_jsonb(device_metrics) order by visitors desc,device) from device_metrics),'[]'::jsonb),
        'browsers',coalesce((select jsonb_agg(to_jsonb(browser_metrics) order by visitors desc,browser) from browser_metrics),'[]'::jsonb)),
      'geography',jsonb_build_object('available',false,'items','[]'::jsonb,'message','Location data is not collected by the current privacy-safe instrumentation.')
    ),
    'comparison',coalesce((select jsonb_object_agg(segment,jsonb_build_object('visitors',visitors,'sessions',sessions,
      'avg_engaged_seconds',avg_engaged_seconds,'avg_scroll_depth',avg_scroll_depth,'converted',converted)) from comparison_metrics),'{}'::jsonb),
    'filters',jsonb_build_object(
      'sources',coalesce((select jsonb_agg(source order by visitors desc,source) from source_metrics),'[]'::jsonb),
      'campaigns',coalesce((select jsonb_agg(campaign order by visitors desc,campaign) from campaign_metrics),'[]'::jsonb)
    )
  ) into result;
  return result;
end;
$$;

create or replace function public.visitor_intelligence_visitors(
  p_start timestamptz,p_end timestamptz,p_page integer default 1,p_page_size integer default 25,
  p_search text default null,p_sort text default 'last_seen_desc',p_device text default null,
  p_status text default null,p_source text default null,p_campaign text default null,p_section text default null,
  p_include_internal boolean default false
) returns jsonb
language plpgsql security invoker
set search_path=pg_catalog,public,visitor_private
as $$
declare result jsonb;
begin
  if p_start is null or p_end is null or p_start>=p_end or p_page not between 1 and 100000
    or p_page_size not between 1 and 100
    or p_sort<>all(array['last_seen_desc','first_seen_desc','visits_desc','engaged_desc','pageviews_desc'])
    or p_device is not null and p_device<>all(array['desktop','tablet','mobile','unknown'])
    or p_status is not null and p_status<>all(array['new','returning','anonymous','registered','converted'])
    or p_search is not null and length(p_search)>100
    or p_source is not null and length(p_source)>100 or p_campaign is not null and length(p_campaign)>100
    or p_section is not null and visitor_private.homepage_section_index(p_section) is null then
    raise exception using errcode='22023',message='visitor_intelligence_invalid_filter';
  end if;

  with session_scope as materialized (
    select s.*,v.first_seen_at visitor_first_seen,v.last_seen_at visitor_last_seen,v.total_visits,
      v.total_pageviews,v.total_engaged_seconds,v.user_id visitor_user_id,v.signed_up_at,v.subscribed_at,v.fingerprint_confidence,
      coalesce(nullif(s.first_attribution->>'utm_source',''),nullif(s.first_attribution->>'referrer',''),'Direct') source,
      coalesce(nullif(s.first_attribution->>'utm_campaign',''),'Unattributed') campaign
    from public.visitor_sessions s join public.visitors v on v.id=s.visitor_id
    where s.started_at>=p_start and s.started_at<p_end and v.revoked_at is null and not v.is_bot and (p_include_internal or not v.is_internal)
      and (p_device is null or coalesce(s.device_profile->>'device_type','unknown')=p_device)
      and (p_source is null or coalesce(nullif(s.first_attribution->>'utm_source',''),nullif(s.first_attribution->>'referrer',''),'Direct')=p_source)
      and (p_campaign is null or coalesce(nullif(s.first_attribution->>'utm_campaign',''),'Unattributed')=p_campaign)
      and (p_section is null or s.homepage_deepest_section_index>=visitor_private.homepage_section_index(p_section))
  ),
  grouped as (
    select visitor_id,visitor_first_seen first_seen_at,visitor_last_seen last_seen_at,max(total_visits)::bigint visits,
      count(*)::bigint sessions,max(total_pageviews)::bigint pageviews,max(total_engaged_seconds)::numeric engaged_seconds,
      max(homepage_deepest_section_index)::integer deepest_section_index,
      (array_agg(homepage_deepest_section_id order by started_at desc))[1] deepest_section_id,
      (array_agg(coalesce(device_profile->>'device_type','unknown') order by started_at desc))[1] device,
      (array_agg(coalesce(device_profile->>'browser','unknown') order by started_at desc))[1] browser,
      (array_agg(source order by started_at desc))[1] source,(array_agg(campaign order by started_at desc))[1] campaign,
      (array_agg(visitor_user_id) filter(where visitor_user_id is not null))[1] user_id,
      max(signed_up_at) signed_up_at,max(subscribed_at) subscribed_at,
      max(fingerprint_confidence)::numeric fingerprint_confidence
    from session_scope group by visitor_id,visitor_first_seen,visitor_last_seen
  ),
  filtered as (
    select *,case when visits>1 then 'Returning' else 'New' end visitor_type,
      case when subscribed_at is not null then 'Paid' when signed_up_at is not null or user_id is not null then 'Registered' else 'Anonymous' end status
    from grouped
    where (p_status is null or case p_status
      when 'new' then visits<=1 when 'returning' then visits>1 when 'anonymous' then user_id is null
      when 'registered' then user_id is not null when 'converted' then signed_up_at is not null or subscribed_at is not null end)
      and (p_search is null or p_search='' or visitor_id::text ilike '%'||p_search||'%'
        or source ilike '%'||p_search||'%' or campaign ilike '%'||p_search||'%'
        or device ilike '%'||p_search||'%' or browser ilike '%'||p_search||'%')
  ),
  ranked as (
    select *,count(*) over() total_count from filtered
    order by
      case when p_sort='last_seen_desc' then last_seen_at end desc,
      case when p_sort='first_seen_desc' then first_seen_at end desc,
      case when p_sort='visits_desc' then visits end desc,
      case when p_sort='engaged_desc' then engaged_seconds end desc,
      case when p_sort='pageviews_desc' then pageviews end desc,
      visitor_id
    limit p_page_size offset (p_page-1)*p_page_size
  )
  select jsonb_build_object('total',coalesce(max(total_count),0),'page',p_page,'page_size',p_page_size,
    'items',coalesce(jsonb_agg(to_jsonb(ranked)-'total_count'),'[]'::jsonb)) into result from ranked;
  return result;
end;
$$;

create or replace function public.visitor_intelligence_profile(p_visitor_id uuid, p_include_internal boolean default false) returns jsonb
language plpgsql security invoker
set search_path=pg_catalog,public,visitor_private
as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'identity',jsonb_build_object('id',v.id,'fingerprint',v.fingerprint,'fingerprint_confidence',v.fingerprint_confidence,
      'match_method',v.identity_match_method,'identity_confidence',v.identity_confidence,'linked',v.user_id is not null,
      'status',case when v.subscribed_at is not null then 'Paid' when v.user_id is not null then 'Registered' else 'Anonymous' end),
    'overview',jsonb_build_object('first_seen_at',v.first_seen_at,'last_seen_at',v.last_seen_at,'visits',v.total_visits,
      'pageviews',v.total_pageviews,'events',v.total_events,'duration_seconds',v.total_duration_seconds,
      'engaged_seconds',v.total_engaged_seconds,'average_session_seconds',v.average_session_seconds),
    'attribution',jsonb_build_object('original',v.first_attribution,'latest',v.latest_attribution),
    'device',v.device_profile,
    'location',jsonb_build_object('available',false,'display','Not available'),
    'behavior',jsonb_build_object('first_page',v.first_page,'last_page',v.last_page,'homepage_engaged_seconds',v.homepage_engaged_seconds,'longest_session_seconds',v.longest_session_seconds),
    'conversion',jsonb_build_object('signed_up_at',v.signed_up_at,'subscribed_at',v.subscribed_at,
      'subscription_status',v.subscription_status,'visits_before_signup',v.visits_before_signup,
      'pageviews_before_signup',v.pageviews_before_signup,'time_to_signup_seconds',v.time_to_signup_seconds),
    'sessions',coalesce((select jsonb_agg(row_data order by started_at desc) from (
      select s.started_at,jsonb_build_object('id',s.id,'started_at',s.started_at,'ended_at',s.ended_at,
        'duration_seconds',s.duration_seconds,'engaged_seconds',s.engaged_seconds,'pageviews',s.pageview_count,
        'entry_page',s.entry_page,'exit_page',s.exit_page,'max_scroll_depth',s.max_scroll_depth,
        'homepage_scroll_depth',s.homepage_scroll_depth,'deepest_section_id',s.homepage_deepest_section_id,
        'device',s.device_profile,'attribution',s.first_attribution) row_data
      from public.visitor_sessions s where s.visitor_id=v.id order by s.started_at desc limit 30
    ) q),'[]'::jsonb),
    'timeline',coalesce((select jsonb_agg(row_data order by occurred_at desc) from (
      select e.occurred_at,jsonb_build_object('id',e.id,'event',e.event_name,'occurred_at',e.occurred_at,
        'page',e.page,'section',e.metadata->>'section_id','element',e.metadata->>'element_id',
        'scroll_depth',e.metadata->>'scroll_depth','engaged_seconds',e.metadata->>'engaged_seconds') row_data
      from public.visitor_events e where e.visitor_id=v.id order by e.occurred_at desc limit 100
    ) q),'[]'::jsonb)
  ) into result
  from public.visitors v where v.id=p_visitor_id and v.revoked_at is null and not v.is_bot and (p_include_internal or not v.is_internal);
  if result is null then raise exception using errcode='P0002',message='visitor_intelligence_not_found'; end if;
  return result;
end;
$$;

create or replace function public.visitor_intelligence_activity(p_since timestamptz default null,p_limit integer default 30,p_include_internal boolean default false) returns jsonb
language plpgsql security invoker
set search_path=pg_catalog,public,visitor_private
as $$
begin
  if p_limit not between 1 and 100 then raise exception using errcode='22023',message='visitor_intelligence_invalid_filter'; end if;
  return coalesce((select jsonb_agg(row_data order by occurred_at desc) from (
    select e.occurred_at,jsonb_build_object('id',e.id,'visitor_id',e.visitor_id,'event',e.event_name,
      'occurred_at',e.occurred_at,'page',e.page,'section',e.metadata->>'section_id',
      'element',e.metadata->>'element_id') row_data
    from public.visitor_events e join public.visitors v on v.id=e.visitor_id
    where v.revoked_at is null and not v.is_bot and (p_include_internal or not v.is_internal)
      and e.occurred_at>=coalesce(p_since,clock_timestamp()-interval '30 minutes')
    order by e.occurred_at desc limit p_limit
  ) q),'[]'::jsonb);
end;
$$;

revoke all on function public.visitor_intelligence_command_center(timestamptz,timestamptz,text,text,boolean,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.visitor_intelligence_visitors(timestamptz,timestamptz,integer,integer,text,text,text,text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.visitor_intelligence_profile(uuid,boolean) from public,anon,authenticated;
revoke all on function public.visitor_intelligence_activity(timestamptz,integer,boolean) from public,anon,authenticated;
grant execute on function public.visitor_intelligence_command_center(timestamptz,timestamptz,text,text,boolean,text,text,text,boolean) to service_role;
grant execute on function public.visitor_intelligence_visitors(timestamptz,timestamptz,integer,integer,text,text,text,text,text,text,text,boolean) to service_role;
grant execute on function public.visitor_intelligence_profile(uuid,boolean) to service_role;
grant execute on function public.visitor_intelligence_activity(timestamptz,integer,boolean) to service_role;

comment on function public.visitor_intelligence_command_center(timestamptz,timestamptz,text,text,boolean,text,text,text,boolean)
  is 'Service-only aggregate read model for the internal Visitor Intelligence command center.';
comment on function public.visitor_intelligence_visitors(timestamptz,timestamptz,integer,integer,text,text,text,text,text,text,text,boolean)
  is 'Service-only bounded and paginated visitor list. Never callable by browser roles.';
comment on function public.visitor_intelligence_profile(uuid,boolean)
  is 'Service-only visitor profile with bounded session and event history.';
comment on function public.visitor_intelligence_activity(timestamptz,integer,boolean)
  is 'Service-only bounded recent visitor event pulse.';

commit;
