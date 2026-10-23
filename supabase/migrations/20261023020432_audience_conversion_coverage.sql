-- Keep conversion denominators within the measured cohort and include saves from lists.
create or replace function public.site_engagement_stats(p_start timestamptz,p_end timestamptz,p_previous_start timestamptz,p_previous_end timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_start is null or p_end is null or p_previous_start is null or p_previous_end is null
    or p_start>p_end or p_previous_start>p_previous_end or p_previous_end>p_start
    or p_end-p_previous_start>interval '182 days' then raise exception 'Invalid analytics period'; end if;
  return (
    with current_views as materialized (
      select * from public.site_page_views where created_at between p_start and p_end
    ), events as materialized (
      select e.*,v.path,v.section,v.device,v.created_at as view_created_at from public.site_analytics_events e
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
        count(distinct page_view_id) filter(where kind='save' and path=target and view_created_at>=p_start) as save_views,
        count(distinct page_view_id) filter(where kind='navigation' and target ~ '^/(news/read|blog|art|artists|gallery)/[^/]+$') as next_clicks,
        count(distinct page_view_id) filter(where kind='outbound') as outbound
      from events group by 1
    ), content_paths as (
      select path from current_views union select path from actions where path like '/%'
    ), content_views as (
      select p.path,coalesce(max(v.section),case
        when p.path='/' then '홈' when p.path like '/artists/%' then '작가'
        when p.path like '/art/%' then '아트' when p.path like '/gallery/%' then '갤러리'
        when p.path like '/references%' then '참고사이트' else '뉴스' end) as section,
        count(v.id) as views,count(distinct v.visitor_hash) as visitors,count(v.active_seconds) as tracked,
        count(v.scroll_depth) as measured,round(avg(v.active_seconds) filter(where v.scroll_depth is not null),1) as active_seconds,
        round(avg(v.scroll_depth),1) as depth,
        count(*) filter(where v.active_seconds>=30 and v.scroll_depth>=75) as deep_reads,
        count(*) filter(where v.scroll_depth>=90) as completions
      from content_paths p left join current_views v on v.path=p.path group by p.path
    ), contents as (
      select c.path,c.section,c.views,c.visitors,c.tracked,c.measured,c.active_seconds as "activeSeconds",c.depth,
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
