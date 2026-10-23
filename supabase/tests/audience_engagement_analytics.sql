-- Execute in a transaction; fixtures and checks are always rolled back by the caller.
do $test$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  test_search uuid := gen_random_uuid();
  visitor text := repeat('a',64); session text := repeat('b',64);
  result jsonb; row jsonb; before_count bigint; t timestamptz := now()-interval '10 minutes';
begin
  insert into public.site_page_views(id,visitor_hash,session_hash,path,section,device,created_at,active_seconds)
    values(a,visitor,session,'/art/analytics-fixture','아트','desktop',t,0),
      (b,visitor,repeat('c',64),'/search','검색','mobile',t+interval '1 minute',0),
      (c,repeat('d',64),repeat('e',64),'/artists/analytics-fixture','작가','desktop',t,null);
  perform public.record_site_analytics_event(gen_random_uuid(),a,visitor,'engagement',45,80);
  perform public.record_site_analytics_event(gen_random_uuid(),a,visitor,'engagement',20,40);
  if not exists(select 1 from public.site_page_views where id=a and active_seconds=45 and scroll_depth=80) then raise exception 'Progress must be monotonic'; end if;
  if public.record_site_analytics_event(gen_random_uuid(),a,repeat('f',64),'engagement',100,100) then raise exception 'Cross-visitor write allowed'; end if;
  perform public.record_site_analytics_event(gen_random_uuid(),b,visitor,'search',p_query=>'없는 검색',p_results=>0,p_search=>test_search);
  perform public.record_site_analytics_event(gen_random_uuid(),b,visitor,'search',p_query=>'없는 검색',p_results=>0,p_search=>test_search);
  perform public.record_site_analytics_event(gen_random_uuid(),b,visitor,'search_click',p_target=>'/art/analytics-fixture',p_search=>test_search);
  perform public.record_site_analytics_event(gen_random_uuid(),b,visitor,'search_click',p_target=>'/art/analytics-fixture',p_search=>test_search);
  if (select count(*) from public.site_analytics_events where search_id=test_search and page_view_id=b)<>2 then raise exception 'Search/click deduplication failed'; end if;
  if public.record_site_analytics_event(gen_random_uuid(),a,visitor,'search_click',p_target=>'/art/analytics-fixture',p_search=>gen_random_uuid()) then raise exception 'Unknown search accepted'; end if;
  perform public.record_site_analytics_event(gen_random_uuid(),a,visitor,'save',p_target=>'/art/analytics-fixture');
  perform public.record_site_analytics_event(gen_random_uuid(),a,visitor,'save',p_target=>'/art/analytics-fixture');
  perform public.record_site_analytics_event(gen_random_uuid(),b,visitor,'save',p_target=>'/art/analytics-no-view');
  result:=public.site_engagement_stats(t-interval '1 minute',now(),t-interval '2 days',t-interval '1 day');
  select value into row from jsonb_array_elements(result->'contents') where value->>'path'='/art/analytics-fixture';
  if (row->>'activeSeconds')::numeric<>45 or (row->>'depth')::numeric<>80 or (row->>'deepReads')::int<>1 or (row->>'saves')::int<>1 or (row->>'saveViews')::int<>1 then raise exception 'Incorrect content metrics: %',row; end if;
  select value into row from jsonb_array_elements(result->'contents') where value->>'path'='/artists/analytics-fixture';
  if row->'activeSeconds'<>'null'::jsonb or (row->>'measured')::int<>0 then raise exception 'Historical NULL must not be a zero-depth read'; end if;
  if (row->>'tracked')::int<>0 then raise exception 'Historical views included in conversion denominator'; end if;
  select value into row from jsonb_array_elements(result->'contents') where value->>'path'='/art/analytics-no-view';
  if row is null or (row->>'views')::int<>0 or (row->>'saves')::int<>1 then raise exception 'List save without detail view missing'; end if;
  if (result->>'returningVisitors')::int<1 then raise exception 'Return visit missing'; end if;
  perform public.site_traffic_stats(now()-interval '89 days',now(),now()-interval '179 days',now()-interval '90 days');
  perform public.site_traffic_sessions(now()-interval '89 days',now(),1,'analytics-fixture');
  result:=public.site_traffic_session_events(session,t-interval '1 minute',now());
  if result->'events'->0->>'active_seconds'<>'45' then raise exception 'Session depth detail missing'; end if;
  if has_table_privilege('anon','public.site_analytics_events','select') or has_table_privilege('authenticated','public.site_analytics_events','insert') then raise exception 'Analytics table exposed'; end if;
  if has_function_privilege('anon','public.site_engagement_stats(timestamptz,timestamptz,timestamptz,timestamptz)','execute') then raise exception 'Analytics RPC exposed'; end if;
  select count(*) into before_count from public.site_analytics_events where page_view_id=a;
  delete from public.site_page_views where id=a;
  if exists(select 1 from public.site_analytics_events where page_view_id=a) or before_count<>1 then raise exception 'Retention cascade failed'; end if;
end;
$test$;
