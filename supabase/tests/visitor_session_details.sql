begin;
do $$
declare
  marker text := 'qa-' || md5(random()::text);
  session_id text := repeat(md5(random()::text), 2);
  ts timestamptz := now() - interval '1 hour';
  result jsonb;
begin
  insert into public.site_page_views(id,visitor_hash,session_hash,path,section,referrer_host,referrer_path,device,is_entry,created_at,ip_address,browser,os,country_code)
  select gen_random_uuid(), repeat(md5(marker || n::text),2), repeat(md5(marker || n::text),2), '/art', '아트', marker || '.example.com', '/landing', 'desktop', true, ts + n * interval '1 second', '192.0.2.1', 'Chrome', 'Windows', 'KR'
  from generate_series(1,21) n;
  result := public.site_traffic_sessions(ts, now(), 1, marker);
  assert (result->>'total')::int = 21 and jsonb_array_length(result->'sessions') = 20, 'Sessions must paginate without truncation';
  result := public.site_traffic_sessions(ts, now(), 2, marker);
  assert (result->>'page')::int = 2 and jsonb_array_length(result->'sessions') = 1, 'Last session page';
  result := public.site_traffic_sessions(ts, now(), 999, marker);
  assert (result->>'page')::int = 2, 'Out of range session page clamps';
  result := public.site_traffic_sessions(ts, now(), 1, marker || '%');
  assert (result->>'total')::int = 0, 'Search is a literal substring';
  insert into public.site_page_views(id,visitor_hash,session_hash,path,section,referrer_host,device,is_entry,created_at)
  select gen_random_uuid(), session_id, session_id, case when n=1 then '/art' else '/artists' end, '아트', case when n=1 then marker || '.example.com' end, 'mobile', n=1, ts + n * interval '1 second'
  from generate_series(1,25) n;
  result := public.site_traffic_session_events(session_id,ts,now(),2);
  assert (result->>'total')::int = 25 and jsonb_array_length(result->'events') = 5, 'Session events paginate';
  assert not has_function_privilege('anon','public.site_traffic_sessions(timestamptz,timestamptz,integer,text)','execute'), 'No public IP/session access';
  assert not has_function_privilege('authenticated','public.site_traffic_session_events(text,timestamptz,timestamptz,integer)','execute'), 'No signed-in raw event access';
  assert (select relrowsecurity from pg_class where oid='public.site_page_views'::regclass), 'RLS preserved';
  begin
    perform public.site_traffic_sessions(ts - interval '90 days',now(),1,'');
    raise exception 'Invalid period was accepted';
  exception when raise_exception then
    assert sqlerrm = 'Invalid visitor query', 'Period limits';
  end;
end;
$$;
rollback;
