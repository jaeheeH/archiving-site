alter table public.site_page_views
  add column active_seconds integer check (active_seconds between 0 and 7200),
  add column scroll_depth smallint check (scroll_depth between 0 and 100),
  add column campaign_source text check (length(campaign_source) <= 64),
  add column campaign_medium text check (length(campaign_medium) <= 64);
alter table public.site_page_views drop constraint site_page_views_section_check;
alter table public.site_page_views add constraint site_page_views_section_check
  check (section in ('홈','뉴스','아트','작가','참고사이트','갤러리','검색'));
grant update (active_seconds, scroll_depth) on public.site_page_views to service_role;

create table public.site_analytics_events (
  id uuid primary key,
  page_view_id uuid not null references public.site_page_views(id) on delete cascade,
  kind text not null check (kind in ('search','search_click','navigation','outbound','save','like','error')),
  target text check (length(target) <= 512 and target !~ '[?#]'),
  query text check (length(query) between 1 and 100),
  results integer check (results between 0 and 1000000),
  search_id uuid,
  error_kind text check (error_kind in ('image','javascript','page')),
  created_at timestamptz not null default now()
);
create index site_analytics_events_view_idx on public.site_analytics_events(page_view_id, kind);
create index site_analytics_events_time_idx on public.site_analytics_events(created_at);
create unique index site_analytics_events_search_idx on public.site_analytics_events(search_id) where kind = 'search';
create unique index site_analytics_events_action_idx on public.site_analytics_events(page_view_id, kind, target) where kind in ('save','like','navigation','outbound');
create unique index site_analytics_events_click_idx on public.site_analytics_events(search_id, target) where kind = 'search_click';
alter table public.site_analytics_events enable row level security;
revoke all on public.site_analytics_events from public, anon, authenticated;
grant select, insert, delete on public.site_analytics_events to service_role;

create function public.record_site_analytics_event(p_id uuid, p_view uuid, p_visitor text, p_kind text,
  p_active integer default null, p_depth integer default null, p_target text default null,
  p_query text default null, p_results integer default null, p_search uuid default null, p_error text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v public.site_page_views;
begin
  select * into v from public.site_page_views where id=p_view and visitor_hash=p_visitor
    and created_at > now()-interval '24 hours' for update;
  if not found then return false; end if;
  if p_kind='engagement' then
    if p_active is null or p_active not between 0 and 7200 or (p_depth is not null and p_depth not between 0 and 100) then
      raise exception 'Invalid engagement';
    end if;
    update public.site_page_views set
      active_seconds=greatest(coalesce(active_seconds,0),least(p_active,greatest(0,extract(epoch from now()-created_at)::int+2))),
      scroll_depth=case when p_depth is null then scroll_depth else greatest(coalesce(scroll_depth,0),p_depth) end
      where id=p_view;
    return true;
  end if;
  if p_kind='search' and (p_search is null or p_query is null or p_results is null) then raise exception 'Invalid search'; end if;
  if p_kind='search_click' and not exists (
    select 1 from public.site_analytics_events s join public.site_page_views sv on sv.id=s.page_view_id
    where s.search_id=p_search and s.kind='search' and sv.visitor_hash=p_visitor
  ) then return false; end if;
  if (select count(*) from public.site_analytics_events where page_view_id=p_view)>=100 then return false; end if;
  insert into public.site_analytics_events(id,page_view_id,kind,target,query,results,search_id,error_kind)
    values(p_id,p_view,p_kind,p_target,p_query,p_results,p_search,p_error) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.record_site_analytics_event(uuid,uuid,text,text,integer,integer,text,text,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.record_site_analytics_event(uuid,uuid,text,text,integer,integer,text,text,integer,uuid,text) to service_role;

-- Old views deliberately retain NULL depth; they must never become zero-depth reads.
create function public.site_engagement_stats(p_start timestamptz,p_end timestamptz,p_previous_start timestamptz,p_previous_end timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_start is null or p_end is null or p_previous_start is null or p_previous_end is null
    or p_start>p_end or p_previous_start>p_previous_end or p_previous_end>p_start
    or p_end-p_previous_start>interval '182 days' then raise exception 'Invalid analytics period'; end if;
  return (
    with current_views as materialized (
      select * from public.site_page_views where created_at between p_start and p_end
    ), events as materialized (
      select e.*,v.path,v.section,v.device from public.site_analytics_events e
      join public.site_page_views v on v.id=e.page_view_id where e.created_at between p_start and p_end
    ), reads as materialized (
      select * from current_views where scroll_depth is not null
    ), lifetime_sessions as materialized (
      select visitor_hash,count(distinct session_hash) as visits,
        count(distinct session_hash) filter(where created_at<=p_previous_end) as previous_visits
      from public.site_page_views where created_at<=p_end group by visitor_hash
    ), actions as (
      select case when kind in ('save','like') then target else path end as path,
        count(*) filter(where kind='save') as saves,count(*) filter(where kind='like') as likes,
        count(distinct page_view_id) filter(where kind='save' and path=target) as save_views,
        count(*) filter(where kind='navigation' and target ~ '^/(news/read|blog|art|artists|gallery)/[^/]+$') as next_clicks,
        count(*) filter(where kind='outbound') as outbound
      from events group by 1
    ), content_views as (
      select path,section,count(*) as views,count(distinct visitor_hash) as visitors,
        count(scroll_depth) as measured,round(avg(active_seconds) filter(where scroll_depth is not null),1) as active_seconds,
        round(avg(scroll_depth),1) as depth,
        count(*) filter(where active_seconds>=30 and scroll_depth>=75) as deep_reads,
        count(*) filter(where scroll_depth>=90) as completions
      from current_views group by path,section
    ), contents as (
      select c.path,c.section,c.views,c.visitors,c.measured,c.active_seconds as "activeSeconds",c.depth,
        c.deep_reads as "deepReads",c.completions,coalesce(a.saves,0) as saves,coalesce(a.save_views,0) as "saveViews",coalesce(a.likes,0) as likes,
        coalesce(a.next_clicks,0) as "nextClicks",coalesce(a.outbound,0) as outbound
      from content_views c left join actions a using(path) order by c.views desc,c.path limit 300
    ), searches as (
      select s.id,s.query,s.section,s.results,exists(select 1 from events c where c.kind='search_click' and c.search_id=s.search_id) as clicked
      from events s where s.kind='search'
    ), keywords as (
      select query,section,count(*) as searches,count(*) filter(where results=0) as "noResults",
        count(*) filter(where clicked) as clicked from searches group by query,section order by searches desc,query limit 100
    ), ordered as (
      select path as "from",lead(path) over(partition by session_hash order by created_at,id) as "to",created_at
      from public.site_page_views where created_at between p_start-interval '30 minutes' and p_end
    ), transitions as (
      select "from","to",count(*) as count from ordered where "to" is not null and "from"<>"to" and created_at>=p_start
      group by "from","to" order by count desc,"from","to" limit 20
    ), device_reads as (
      select device,count(scroll_depth) as measured,round(avg(active_seconds) filter(where scroll_depth is not null),1) as "activeSeconds",round(avg(scroll_depth),1) as depth,
        count(*) filter(where active_seconds>=30 and scroll_depth>=75) as "deepReads" from current_views group by device
    ), devices as (
      select d.device,d.measured,d."activeSeconds",d.depth,d."deepReads",
        (select count(*) from events e where e.device=d.device and e.kind='error') as errors from device_reads d
    ), error_pages as (
      select path,error_kind as kind,count(*) as count from events where kind='error'
      group by path,error_kind order by count desc,path limit 20
    )
    select jsonb_build_object(
      'since',(select min(created_at) from public.site_page_views where active_seconds is not null),
      'returningVisitors',(select count(distinct c.visitor_hash) from current_views c join lifetime_sessions l using(visitor_hash) where l.visits>1),
      'previousReturningVisitors',(select count(distinct v.visitor_hash) from public.site_page_views v join lifetime_sessions l using(visitor_hash) where l.previous_visits>1 and v.created_at between p_previous_start and p_previous_end),
      'measured',(select count(*) from reads),'activeSeconds',(select round(avg(active_seconds),1) from reads),
      'depth',(select round(avg(scroll_depth),1) from reads),'deepReads',(select count(*) from reads where active_seconds>=30 and scroll_depth>=75),
      'completions',(select count(*) from reads where scroll_depth>=90),
      'saves',(select count(*) from events where kind='save'),'likes',(select count(*) from events where kind='like'),
      'searchCount',(select count(*) from searches),'noResults',(select count(*) from searches where results=0),
      'searchClicks',(select count(*) from searches where clicked),'errors',(select count(*) from events where kind='error'),
      'contents',coalesce((select jsonb_agg(to_jsonb(contents)) from contents),'[]'::jsonb),
      'keywords',coalesce((select jsonb_agg(to_jsonb(keywords)) from keywords),'[]'::jsonb),
      'transitions',coalesce((select jsonb_agg(to_jsonb(transitions)) from transitions),'[]'::jsonb),
      'devices',coalesce((select jsonb_agg(to_jsonb(devices)) from devices),'[]'::jsonb),
      'errorPages',coalesce((select jsonb_agg(to_jsonb(error_pages)) from error_pages),'[]'::jsonb)
    )
  );
end;
$$;
revoke all on function public.site_engagement_stats(timestamptz,timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.site_engagement_stats(timestamptz,timestamptz,timestamptz,timestamptz) to service_role;

-- Compare articles using the first seven days since publication, never lifetime counts.
create function public.site_content_launch_stats(p_start timestamptz,p_end timestamptz)
returns table(path text, published_at timestamptz, first7_views bigint, observed_days numeric)
language sql stable security invoker set search_path='' as $$
  select '/news/read/'||p.slug,p.published_at,count(v.id),
    least(7,greatest(0,extract(epoch from p_end-p.published_at)/86400))::numeric
  from public.posts p left join public.site_page_views v
    on v.path in ('/news/read/'||p.slug,'/blog/'||p.slug)
    and v.created_at>=p.published_at and v.created_at<least(p.published_at+interval '7 days',p_end)
  where p.is_published and p.type in ('news','blog') and p.published_at between p_start and p_end
    and p_end-p_start<=interval '91 days'
  group by p.id,p.slug,p.published_at;
$$;
revoke all on function public.site_content_launch_stats(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.site_content_launch_stats(timestamptz,timestamptz) to service_role;

-- Preserve existing RPCs, extend only their accepted period and detail fields.
do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.site_traffic_stats(timestamptz,timestamptz,timestamptz,timestamptz)'::regprocedure) into definition;
  definition:=replace(definition, 'interval ''62 days''', 'interval ''182 days''');
  definition:=replace(definition, 'coalesce(referrer_host, ''직접·출처 없음'')', 'coalesce(campaign_source, referrer_host, ''직접·출처 없음'')');
  definition:=replace(definition, 'group by referrer_host order', 'group by coalesce(campaign_source, referrer_host, ''직접·출처 없음'') order');
  execute definition;
  select pg_get_functiondef('public.site_traffic_sessions(timestamptz,timestamptz,integer,text)'::regprocedure) into definition;
  execute replace(definition, 'interval ''31 days''', 'interval ''91 days''');
  select pg_get_functiondef('public.site_traffic_session_events(text,timestamptz,timestamptz,integer)'::regprocedure) into definition;
  definition:=replace(definition, 'interval ''31 days''', 'interval ''91 days''');
  definition:=replace(definition, 'referrer_host, referrer_path,', 'referrer_host, referrer_path, active_seconds, scroll_depth,');
  execute definition;
end;
$migration$;
