begin;
insert into public.site_page_views (id, visitor_hash, session_hash, path, section, referrer_host, device, is_entry, created_at) values
  (gen_random_uuid(), repeat('a',64), repeat('c',64), '/', '홈', null, 'desktop', true, '2000-01-06T15:00:00Z'),
  (gen_random_uuid(), repeat('a',64), repeat('c',64), '/art', '아트', null, 'desktop', false, '2000-01-07T05:00:00Z'),
  (gen_random_uuid(), repeat('b',64), repeat('d',64), '/news/stories', '뉴스', 'naver.com', 'mobile', true, '2000-01-07T05:00:00Z'),
  (gen_random_uuid(), repeat('a',64), repeat('e',64), '/gallery', '갤러리', null, 'desktop', true, '2000-01-06T10:00:00Z'),
  (gen_random_uuid(), repeat('f',64), repeat('1',64), '/', '홈', null, 'desktop', true, '2000-01-04T20:00:00Z'),
  (gen_random_uuid(), repeat('a',64), repeat('2',64), '/', '홈', null, 'desktop', true, '2000-01-07T06:00:00Z');
do $$
declare stats jsonb;
begin
  stats := public.site_traffic_stats('2000-01-05T15:00:00Z', '2000-01-07T05:00:00Z', '2000-01-03T15:00:00Z', '2000-01-05T05:00:00Z');
  assert (stats->>'visitors')::int = 2, 'Period visitor uniqueness';
  assert (stats->>'sessions')::int = 3, 'Distinct visits';
  assert (stats->>'pageviews')::int = 4, 'Page views and future exclusion';
  assert (stats->>'previousVisitors')::int = 1, 'Previous same-time window';
  assert stats->'daily'->0->>'date' = '2000-01-06', 'Korean calendar boundary';
  assert (stats->'daily'->1->>'visitors')::int = 2, 'Daily uniqueness';
  assert (stats->'referrers'->0->>'count')::int = 2, 'Entry-only attribution';
  assert jsonb_array_length(stats->'pages') = 4, 'Page ranking';
  assert not has_table_privilege('anon', 'public.site_page_views', 'select'), 'No anonymous raw access';
  assert not has_table_privilege('authenticated', 'public.site_page_views', 'select'), 'No user raw access';
  assert not has_function_privilege('anon', 'public.site_traffic_stats(timestamptz,timestamptz,timestamptz,timestamptz)', 'execute'), 'No public aggregation';
  assert (select relrowsecurity from pg_class where oid='public.site_page_views'::regclass), 'RLS enabled';
end;
$$;
rollback;
