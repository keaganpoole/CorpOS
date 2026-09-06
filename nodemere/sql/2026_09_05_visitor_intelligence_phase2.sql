-- Visitor Intelligence Phase 2: homepage section, click and flow rollups.
-- Run after 2026_09_05_visitor_intelligence_phase1.sql as database owner.

begin;

alter table public.visitor_sessions
  add column homepage_deepest_section_id text,
  add column homepage_deepest_section_index smallint,
  add column homepage_section_views integer not null default 0,
  add constraint visitor_sessions_homepage_section_index_check
    check (homepage_deepest_section_index is null or homepage_deepest_section_index between 0 and 63);

create table public.homepage_section_hourly (
  bucket_start timestamptz not null,
  section_id text not null,
  section_index smallint not null check (section_index between 0 and 63),
  device_class text not null check (device_class in ('desktop','tablet','mobile','unknown')),
  unique_visitors bigint not null default 0 check (unique_visitors >= 0),
  total_views bigint not null default 0 check (total_views >= 0),
  visible_seconds_sum numeric(20,3) not null default 0 check (visible_seconds_sum >= 0),
  visible_samples bigint not null default 0 check (visible_samples >= 0),
  duration_histogram bigint[] not null default array_fill(0::bigint,array[12]),
  clicks bigint not null default 0 check (clicks >= 0),
  cta_clicks bigint not null default 0 check (cta_clicks >= 0),
  continuations bigint not null default 0 check (continuations >= 0),
  dropoffs bigint not null default 0 check (dropoffs >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (bucket_start,section_id,section_index,device_class),
  check (cardinality(duration_histogram)=12)
);

create table public.homepage_section_daily (like public.homepage_section_hourly including defaults including constraints);
alter table public.homepage_section_daily drop column bucket_start;
alter table public.homepage_section_daily add column bucket_date date not null;
alter table public.homepage_section_daily add primary key (bucket_date,section_id,section_index,device_class);

create table public.homepage_click_hourly (
  bucket_start timestamptz not null,
  section_id text not null,
  section_index smallint not null check (section_index between -1 and 63),
  element_id text not null,
  element_type text not null check (element_type in ('button','link','input','other')),
  device_class text not null check (device_class in ('desktop','tablet','mobile','unknown')),
  viewport_bucket text not null check (viewport_bucket in ('mobile-narrow','mobile-wide','tablet','desktop','desktop-wide')),
  x_cell smallint not null check (x_cell between 0 and 19),
  y_cell smallint not null check (y_cell between 0 and 19),
  clicks bigint not null default 0 check (clicks >= 0),
  cta_clicks bigint not null default 0 check (cta_clicks >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (bucket_start,section_id,section_index,element_id,element_type,device_class,viewport_bucket,x_cell,y_cell)
);

create table public.homepage_click_daily (like public.homepage_click_hourly including defaults including constraints);
alter table public.homepage_click_daily drop column bucket_start;
alter table public.homepage_click_daily add column bucket_date date not null;
alter table public.homepage_click_daily add primary key (bucket_date,section_id,section_index,element_id,element_type,device_class,viewport_bucket,x_cell,y_cell);

create table public.homepage_flow_hourly (
  bucket_start timestamptz not null,
  from_section_id text not null,
  from_section_index smallint not null check (from_section_index between 0 and 63),
  to_section_id text not null,
  to_section_index smallint not null check (to_section_index between 0 and 63),
  device_class text not null check (device_class in ('desktop','tablet','mobile','unknown')),
  transitions bigint not null default 0 check (transitions >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (bucket_start,from_section_id,from_section_index,to_section_id,to_section_index,device_class),
  check (from_section_id<>to_section_id)
);

create table public.homepage_flow_daily (like public.homepage_flow_hourly including defaults including constraints);
alter table public.homepage_flow_daily drop column bucket_start;
alter table public.homepage_flow_daily add column bucket_date date not null;
alter table public.homepage_flow_daily add primary key (bucket_date,from_section_id,from_section_index,to_section_id,to_section_index,device_class);

create table visitor_private.homepage_section_hourly_visitors (
  bucket_start timestamptz not null,
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  section_id text not null,
  section_index smallint not null,
  device_class text not null,
  primary key (bucket_start,visitor_id,section_id,section_index,device_class)
);

create table visitor_private.homepage_section_daily_visitors (
  bucket_date date not null,
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  section_id text not null,
  section_index smallint not null,
  device_class text not null,
  primary key (bucket_date,visitor_id,section_id,section_index,device_class)
);

create index homepage_section_hourly_recent on public.homepage_section_hourly(bucket_start desc,section_index,device_class);
create index homepage_section_daily_recent on public.homepage_section_daily(bucket_date desc,section_index,device_class);
create index homepage_click_hourly_recent on public.homepage_click_hourly(bucket_start desc,section_index,device_class,viewport_bucket);
create index homepage_click_daily_recent on public.homepage_click_daily(bucket_date desc,section_index,device_class,viewport_bucket);
create index homepage_flow_hourly_recent on public.homepage_flow_hourly(bucket_start desc,from_section_index,to_section_index,device_class);
create index homepage_flow_daily_recent on public.homepage_flow_daily(bucket_date desc,from_section_index,to_section_index,device_class);

alter table public.homepage_section_hourly enable row level security;
alter table public.homepage_section_hourly force row level security;
alter table public.homepage_section_daily enable row level security;
alter table public.homepage_section_daily force row level security;
alter table public.homepage_click_hourly enable row level security;
alter table public.homepage_click_hourly force row level security;
alter table public.homepage_click_daily enable row level security;
alter table public.homepage_click_daily force row level security;
alter table public.homepage_flow_hourly enable row level security;
alter table public.homepage_flow_hourly force row level security;
alter table public.homepage_flow_daily enable row level security;
alter table public.homepage_flow_daily force row level security;
alter table visitor_private.homepage_section_hourly_visitors enable row level security;
alter table visitor_private.homepage_section_hourly_visitors force row level security;
alter table visitor_private.homepage_section_daily_visitors enable row level security;
alter table visitor_private.homepage_section_daily_visitors force row level security;

revoke all on public.homepage_section_hourly,public.homepage_section_daily,
  public.homepage_click_hourly,public.homepage_click_daily,
  public.homepage_flow_hourly,public.homepage_flow_daily,
  visitor_private.homepage_section_hourly_visitors,visitor_private.homepage_section_daily_visitors
  from public,anon,authenticated;
grant all on public.homepage_section_hourly,public.homepage_section_daily,
  public.homepage_click_hourly,public.homepage_click_daily,
  public.homepage_flow_hourly,public.homepage_flow_daily,
  visitor_private.homepage_section_hourly_visitors,visitor_private.homepage_section_daily_visitors
  to service_role;

create function visitor_private.homepage_section_index(p_section text) returns smallint
language sql immutable strict security invoker set search_path=pg_catalog
as $$ select case p_section
  when 'hero' then 0 when 'calendar' then 1 when 'people-crm' then 2
  when 'live-monitoring' then 3 when 'comparison' then 4 when 'scenarios' then 5
  when 'security' then 6 when 'header' then -1 end::smallint $$;

create function visitor_private.homepage_duration_add(p_histogram bigint[],p_seconds numeric) returns bigint[]
language plpgsql immutable security invoker set search_path=pg_catalog
as $$
declare h bigint[]:=coalesce(p_histogram,array_fill(0::bigint,array[12])); i integer;
begin
  i:=case when p_seconds<=1 then 1 when p_seconds<=3 then 2 when p_seconds<=5 then 3
    when p_seconds<=10 then 4 when p_seconds<=20 then 5 when p_seconds<=30 then 6
    when p_seconds<=60 then 7 when p_seconds<=120 then 8 when p_seconds<=300 then 9
    when p_seconds<=600 then 10 when p_seconds<=1800 then 11 else 12 end;
  h[i]:=h[i]+1;
  return h;
end;
$$;

create function visitor_private.homepage_duration_median(p_histogram bigint[]) returns numeric
language plpgsql immutable security invoker set search_path=pg_catalog
as $$
declare total bigint:=0; running bigint:=0; target bigint; i integer;
  midpoints numeric[]:=array[0.5,2,4,7.5,15,25,45,90,210,450,1200,3600];
begin
  if p_histogram is null or cardinality(p_histogram)<>12 then return null; end if;
  select coalesce(sum(value),0) into total from unnest(p_histogram) value;
  if total=0 then return null; end if;
  target:=(total+1)/2;
  for i in 1..12 loop
    running:=running+p_histogram[i];
    if running>=target then return midpoints[i]; end if;
  end loop;
  return midpoints[12];
end;
$$;

create function visitor_private.homepage_viewport_bucket(p_width integer) returns text
language sql immutable strict security invoker set search_path=pg_catalog
as $$ select case when p_width<390 then 'mobile-narrow' when p_width<768 then 'mobile-wide'
  when p_width<1024 then 'tablet' when p_width<1440 then 'desktop' else 'desktop-wide' end $$;

create function visitor_private.homepage_rollup_event(
  p_event public.visitor_events,p_device jsonb,p_is_bot boolean,p_is_internal boolean
) returns void
language plpgsql security invoker set search_path=pg_catalog,public,visitor_private
as $$
declare
  m jsonb:=p_event.metadata; event_hour timestamptz:=date_trunc('hour',p_event.occurred_at);
  event_day date:=(p_event.occurred_at at time zone 'UTC')::date;
  v_section_id text:=m->>'section_id'; v_section_index smallint:=(m->>'section_index')::smallint;
  v_device_class text:=coalesce(m->>'device_class',p_device->>'device_type','unknown');
  is_cta bigint:=(p_event.event_name='cta_click')::integer;
  hour_unique integer:=0; day_unique integer:=0; v_visible_seconds numeric;
  v_viewport_width integer; v_viewport_bucket text; v_x_cell smallint; v_y_cell smallint;
begin
  if coalesce(p_is_bot,false) or coalesce(p_is_internal,false) or p_event.page<>'/' then return; end if;

  if p_event.event_name='section_view' then
    insert into visitor_private.homepage_section_hourly_visitors(bucket_start,visitor_id,section_id,section_index,device_class)
      values(event_hour,p_event.visitor_id,v_section_id,v_section_index,v_device_class) on conflict do nothing;
    get diagnostics hour_unique=row_count;
    insert into visitor_private.homepage_section_daily_visitors(bucket_date,visitor_id,section_id,section_index,device_class)
      values(event_day,p_event.visitor_id,v_section_id,v_section_index,v_device_class) on conflict do nothing;
    get diagnostics day_unique=row_count;
    insert into public.homepage_section_hourly(bucket_start,section_id,section_index,device_class,unique_visitors,total_views)
      values(event_hour,v_section_id,v_section_index,v_device_class,hour_unique,1)
      on conflict(bucket_start,section_id,section_index,device_class) do update set
        unique_visitors=homepage_section_hourly.unique_visitors+excluded.unique_visitors,
        total_views=homepage_section_hourly.total_views+1,updated_at=clock_timestamp();
    insert into public.homepage_section_daily(bucket_date,section_id,section_index,device_class,unique_visitors,total_views)
      values(event_day,v_section_id,v_section_index,v_device_class,day_unique,1)
      on conflict(bucket_date,section_id,section_index,device_class) do update set
        unique_visitors=homepage_section_daily.unique_visitors+excluded.unique_visitors,
        total_views=homepage_section_daily.total_views+1,updated_at=clock_timestamp();
    update public.visitor_sessions set
      homepage_deepest_section_id=case when coalesce(homepage_deepest_section_index,-1)<v_section_index then v_section_id else homepage_deepest_section_id end,
      homepage_deepest_section_index=greatest(coalesce(homepage_deepest_section_index,-1),v_section_index),
      homepage_section_views=homepage_section_views+1 where id=p_event.session_id;
  elsif p_event.event_name='section_attention' then
    v_visible_seconds:=(m->>'visible_seconds')::numeric;
    insert into public.homepage_section_hourly(bucket_start,section_id,section_index,device_class,
      visible_seconds_sum,visible_samples,duration_histogram,continuations,dropoffs)
      values(event_hour,v_section_id,v_section_index,v_device_class,v_visible_seconds,1,
        visitor_private.homepage_duration_add(null,v_visible_seconds),(m->>'continued')::boolean::integer,
        (not (m->>'continued')::boolean)::integer)
      on conflict(bucket_start,section_id,section_index,device_class) do update set
        visible_seconds_sum=homepage_section_hourly.visible_seconds_sum+excluded.visible_seconds_sum,
        visible_samples=homepage_section_hourly.visible_samples+1,
        duration_histogram=visitor_private.homepage_duration_add(homepage_section_hourly.duration_histogram,v_visible_seconds),
        continuations=homepage_section_hourly.continuations+excluded.continuations,
        dropoffs=homepage_section_hourly.dropoffs+excluded.dropoffs,updated_at=clock_timestamp();
    insert into public.homepage_section_daily(bucket_date,section_id,section_index,device_class,
      visible_seconds_sum,visible_samples,duration_histogram,continuations,dropoffs)
      values(event_day,v_section_id,v_section_index,v_device_class,v_visible_seconds,1,
        visitor_private.homepage_duration_add(null,v_visible_seconds),(m->>'continued')::boolean::integer,
        (not (m->>'continued')::boolean)::integer)
      on conflict(bucket_date,section_id,section_index,device_class) do update set
        visible_seconds_sum=homepage_section_daily.visible_seconds_sum+excluded.visible_seconds_sum,
        visible_samples=homepage_section_daily.visible_samples+1,
        duration_histogram=visitor_private.homepage_duration_add(homepage_section_daily.duration_histogram,v_visible_seconds),
        continuations=homepage_section_daily.continuations+excluded.continuations,
        dropoffs=homepage_section_daily.dropoffs+excluded.dropoffs,updated_at=clock_timestamp();
  elsif p_event.event_name in ('homepage_click','cta_click','navigation_click') and v_section_id is not null then
    v_viewport_width:=(m->>'viewport_width')::integer;
    v_viewport_bucket:=visitor_private.homepage_viewport_bucket(v_viewport_width);
    v_x_cell:=least(19,floor((m->>'normalized_x')::numeric*20)::smallint);
    v_y_cell:=least(19,floor((m->>'normalized_y')::numeric*20)::smallint);
    insert into public.homepage_click_hourly(bucket_start,section_id,section_index,element_id,element_type,
      device_class,viewport_bucket,x_cell,y_cell,clicks,cta_clicks)
      values(event_hour,v_section_id,v_section_index,m->>'element_id',m->>'element_type',v_device_class,
        v_viewport_bucket,v_x_cell,v_y_cell,1,is_cta)
      on conflict(bucket_start,section_id,section_index,element_id,element_type,device_class,viewport_bucket,x_cell,y_cell)
      do update set clicks=homepage_click_hourly.clicks+1,cta_clicks=homepage_click_hourly.cta_clicks+excluded.cta_clicks,updated_at=clock_timestamp();
    insert into public.homepage_click_daily(bucket_date,section_id,section_index,element_id,element_type,
      device_class,viewport_bucket,x_cell,y_cell,clicks,cta_clicks)
      values(event_day,v_section_id,v_section_index,m->>'element_id',m->>'element_type',v_device_class,
        v_viewport_bucket,v_x_cell,v_y_cell,1,is_cta)
      on conflict(bucket_date,section_id,section_index,element_id,element_type,device_class,viewport_bucket,x_cell,y_cell)
      do update set clicks=homepage_click_daily.clicks+1,cta_clicks=homepage_click_daily.cta_clicks+excluded.cta_clicks,updated_at=clock_timestamp();
    if v_section_index>=0 then
      insert into public.homepage_section_hourly(bucket_start,section_id,section_index,device_class,clicks,cta_clicks)
        values(event_hour,v_section_id,v_section_index,v_device_class,1,is_cta)
        on conflict(bucket_start,section_id,section_index,device_class) do update set
          clicks=homepage_section_hourly.clicks+1,cta_clicks=homepage_section_hourly.cta_clicks+excluded.cta_clicks,updated_at=clock_timestamp();
      insert into public.homepage_section_daily(bucket_date,section_id,section_index,device_class,clicks,cta_clicks)
        values(event_day,v_section_id,v_section_index,v_device_class,1,is_cta)
        on conflict(bucket_date,section_id,section_index,device_class) do update set
          clicks=homepage_section_daily.clicks+1,cta_clicks=homepage_section_daily.cta_clicks+excluded.cta_clicks,updated_at=clock_timestamp();
    end if;
  elsif p_event.event_name='section_progression' then
    insert into public.homepage_flow_hourly(bucket_start,from_section_id,from_section_index,to_section_id,to_section_index,device_class,transitions)
      values(event_hour,m->>'from_section_id',(m->>'from_section_index')::smallint,m->>'to_section_id',(m->>'to_section_index')::smallint,v_device_class,1)
      on conflict(bucket_start,from_section_id,from_section_index,to_section_id,to_section_index,device_class)
      do update set transitions=homepage_flow_hourly.transitions+1,updated_at=clock_timestamp();
    insert into public.homepage_flow_daily(bucket_date,from_section_id,from_section_index,to_section_id,to_section_index,device_class,transitions)
      values(event_day,m->>'from_section_id',(m->>'from_section_index')::smallint,m->>'to_section_id',(m->>'to_section_index')::smallint,v_device_class,1)
      on conflict(bucket_date,from_section_id,from_section_index,to_section_id,to_section_index,device_class)
      do update set transitions=homepage_flow_daily.transitions+1,updated_at=clock_timestamp();
  end if;
end;
$$;

create function public.visitor_ingest_phase2(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public,visitor_private
as $$
declare
  e jsonb; m jsonb; name text; page text; event_id uuid; transformed jsonb; result jsonb;
  new_ids uuid[]; stored public.visitor_events; idx smallint; deepest_idx smallint;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_payload->'events')<>'array' then
    raise exception using errcode='22023',message='visitor_invalid_payload';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('visitor:'||(p_payload->>'visitor_id'),0));
  for e in select value from jsonb_array_elements(p_payload->'events') loop
    name:=e->>'name'; page:=e->>'page'; m:=coalesce(e->'metadata','{}'::jsonb);
    if name is null or name<>all(array['session_start','session_end','page_view','page_leave','engagement',
      'cta_click','navigation_click','homepage_click','section_view','section_attention','section_progression',
      'scroll_25','scroll_50','scroll_75','scroll_90','scroll_100','form_started','field_focused',
      'form_completed','signup_started','checkout_started']) or jsonb_typeof(m)<>'object' then
      raise exception using errcode='22023',message='visitor_invalid_event';
    end if;
    if exists(select from jsonb_object_keys(m) k where k<>all(array['engaged_seconds','scroll_depth',
      'element_id','element_type','section_id','section_index','from_section_id','from_section_index',
      'to_section_id','to_section_index','deepest_section_id','deepest_section_index','href','device_class',
      'viewport_width','viewport_height','normalized_x','normalized_y','visible_seconds','continued','form_id','field_id'])) then
      raise exception using errcode='22023',message='visitor_invalid_metadata';
    end if;
    if name in ('homepage_click','section_view','section_attention','section_progression') and page<>'/' then
      raise exception using errcode='22023',message='visitor_homepage_event_page';
    end if;
    if name in ('homepage_click','section_view','section_attention') then
      idx:=visitor_private.homepage_section_index(m->>'section_id');
      if idx is null or idx<>(m->>'section_index')::smallint or (name<>'homepage_click' and idx<0)
        or m->>'device_class'<>all(array['desktop','tablet','mobile','unknown'])
        or jsonb_typeof(m->'viewport_width')<>'number' or (m->>'viewport_width')::numeric<>trunc((m->>'viewport_width')::numeric)
        or (m->>'viewport_width')::integer not between 1 and 16384
        or jsonb_typeof(m->'viewport_height')<>'number' or (m->>'viewport_height')::numeric<>trunc((m->>'viewport_height')::numeric)
        or (m->>'viewport_height')::integer not between 1 and 16384 then
        raise exception using errcode='22023',message='visitor_invalid_homepage_section';
      end if;
    end if;
    if name='homepage_click' then
      if jsonb_typeof(m->'normalized_x')<>'number' or (m->>'normalized_x')::numeric not between 0 and 1
        or jsonb_typeof(m->'normalized_y')<>'number' or (m->>'normalized_y')::numeric not between 0 and 1
        or m->>'element_id' !~ '^[a-z][a-z0-9_-]{0,63}$'
        or m->>'element_type'<>all(array['button','link','input','other']) then
        raise exception using errcode='22023',message='visitor_invalid_homepage_click';
      end if;
    end if;
    if name in ('cta_click','navigation_click') and page='/' and m ? 'section_id' then
      idx:=visitor_private.homepage_section_index(m->>'section_id');
      if idx is null or idx<>(m->>'section_index')::smallint
        or jsonb_typeof(m->'normalized_x')<>'number' or (m->>'normalized_x')::numeric not between 0 and 1
        or jsonb_typeof(m->'normalized_y')<>'number' or (m->>'normalized_y')::numeric not between 0 and 1
        or jsonb_typeof(m->'viewport_width')<>'number' or (m->>'viewport_width')::integer not between 1 and 16384
        or jsonb_typeof(m->'viewport_height')<>'number' or (m->>'viewport_height')::integer not between 1 and 16384 then
        raise exception using errcode='22023',message='visitor_invalid_homepage_click';
      end if;
    end if;
    if name='section_attention' then
      deepest_idx:=visitor_private.homepage_section_index(m->>'deepest_section_id');
      if jsonb_typeof(m->'visible_seconds')<>'number' or (m->>'visible_seconds')::numeric not between 1 and 86400
        or jsonb_typeof(m->'continued')<>'boolean' or deepest_idx is null or deepest_idx<>(m->>'deepest_section_index')::smallint
        or deepest_idx<idx or (m->>'continued')::boolean is distinct from (deepest_idx>idx) then
        raise exception using errcode='22023',message='visitor_invalid_section_attention';
      end if;
    end if;
    if name='section_progression' then
      if visitor_private.homepage_section_index(m->>'from_section_id') is distinct from (m->>'from_section_index')::smallint
        or visitor_private.homepage_section_index(m->>'to_section_id') is distinct from (m->>'to_section_index')::smallint
        or (m->>'from_section_index')::smallint<0 or (m->>'to_section_index')::smallint<0
        or m->>'from_section_id'=m->>'to_section_id'
        or m->>'device_class'<>all(array['desktop','tablet','mobile','unknown']) then
        raise exception using errcode='22023',message='visitor_invalid_section_progression';
      end if;
    end if;
  end loop;

  select array_agg(distinct (value->>'id')::uuid) into new_ids
    from jsonb_array_elements(p_payload->'events')
    where not exists(select from visitor_private.event_receipts where id=(value->>'id')::uuid);
  select jsonb_agg(jsonb_set(jsonb_set(value,'{name}',to_jsonb(
      case when value->>'name' in ('homepage_click','section_view','section_attention','section_progression')
        then 'navigation_click' else value->>'name' end)),
      '{metadata}',coalesce(value->'metadata','{}'::jsonb)-array['section_index','from_section_id','from_section_index',
        'to_section_id','to_section_index','deepest_section_id','deepest_section_index','viewport_width','viewport_height',
        'normalized_x','normalized_y','visible_seconds','continued']) order by ordinality)
    into transformed from jsonb_array_elements(p_payload->'events') with ordinality;
  result:=public.visitor_ingest(jsonb_set(p_payload,'{events}',transformed));

  if new_ids is not null then
    for e in select distinct on ((value->>'id')::uuid) value
      from jsonb_array_elements(p_payload->'events') with ordinality
      where (value->>'id')::uuid=any(new_ids)
      order by (value->>'id')::uuid,(value->>'occurred_at')::timestamptz,ordinality loop
      event_id:=(e->>'id')::uuid;
      update public.visitor_events set event_name=e->>'name',metadata=coalesce(e->'metadata','{}'::jsonb)
        where id=event_id and visitor_id=(p_payload->>'visitor_id')::uuid returning * into stored;
      if found then
        perform visitor_private.homepage_rollup_event(stored,p_payload->'device_profile',
          coalesce((p_payload->>'is_bot')::boolean,false),coalesce((p_payload->>'is_internal')::boolean,false));
      end if;
    end loop;
  end if;
  return result;
end;
$$;

create view visitor_private.homepage_section_daily_metrics with (security_invoker=true) as
with hero as (
  select bucket_date,device_class,unique_visitors hero_visitors
  from public.homepage_section_daily where section_index=0
)
select s.bucket_date,s.section_id,s.section_index,s.device_class,s.unique_visitors,s.total_views,
  round(s.visible_seconds_sum/nullif(s.visible_samples,0),3) average_visible_seconds,
  visitor_private.homepage_duration_median(s.duration_histogram) median_visible_seconds,
  s.clicks,s.cta_clicks,s.continuations,s.dropoffs,
  round(100*s.unique_visitors/nullif(h.hero_visitors,0),2) reach_rate,
  round(100*s.continuations/nullif(s.continuations+s.dropoffs,0),2) continuation_rate,
  round(100*s.dropoffs/nullif(s.continuations+s.dropoffs,0),2) dropoff_rate,
  round(100*(0.45*least(1,coalesce(s.visible_seconds_sum/nullif(s.visible_samples,0),0)/30)
    +0.30*least(1,s.clicks::numeric/nullif(s.total_views,0))
    +0.25*coalesce(s.continuations::numeric/nullif(s.continuations+s.dropoffs,0),0)),1) engagement_score,
  (100*s.dropoffs/nullif(s.continuations+s.dropoffs,0)>=25
    or (s.dropoffs>=10 and 100*s.dropoffs/nullif(s.continuations+s.dropoffs,0)>=15)) is_major_dropoff
from public.homepage_section_daily s
left join hero h using(bucket_date,device_class);

revoke all on function visitor_private.homepage_section_index(text),
  visitor_private.homepage_duration_add(bigint[],numeric),visitor_private.homepage_duration_median(bigint[]),
  visitor_private.homepage_viewport_bucket(integer),
  visitor_private.homepage_rollup_event(public.visitor_events,jsonb,boolean,boolean),
  public.visitor_ingest_phase2(jsonb) from public,anon,authenticated;
grant execute on function visitor_private.homepage_section_index(text),
  visitor_private.homepage_duration_add(bigint[],numeric),visitor_private.homepage_duration_median(bigint[]),
  visitor_private.homepage_viewport_bucket(integer),
  visitor_private.homepage_rollup_event(public.visitor_events,jsonb,boolean,boolean),
  public.visitor_ingest_phase2(jsonb) to service_role;
revoke all on visitor_private.homepage_section_daily_metrics from public,anon,authenticated;
grant select on visitor_private.homepage_section_daily_metrics to service_role;
notify pgrst, 'reload schema';
commit;
