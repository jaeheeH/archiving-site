begin;
do $$
declare a uuid; b uuid; event_id uuid := gen_random_uuid(); stats jsonb;
begin
  insert into public.banners (title,image_url,kind,is_active) values ('Disposable banner analytics test','/banners/archb-art-banner.webp','ad',false) returning id into a;
  insert into public.banners (title,image_url,kind,is_active) values ('Disposable plain link test','/banners/archb-art-banner.webp','link',false) returning id into b;
  insert into public.banner_events (id,banner_id,event_type,path,created_at) values
    (event_id,a,'impression','/','1999-12-31T15:00:00Z'),
    (gen_random_uuid(),a,'impression','/news/stories','2000-01-01T10:00:00Z');
  begin
    insert into public.banner_events (id,banner_id,event_type,path) values (event_id,a,'impression','/');
    assert false, 'Repeated event ID must be rejected';
  exception when unique_violation then null; end;
  insert into public.banner_events (id,banner_id,event_type,path,ip_hash,created_at) values
    (gen_random_uuid(),a,'click','/',repeat('a',64),'1999-12-31T15:00:00Z'),
    (gen_random_uuid(),a,'click','/',repeat('a',64),'2000-01-01T15:00:00Z'),
    (gen_random_uuid(),a,'click','/',repeat('b',64),'2000-01-01T12:00:00Z'),
    (gen_random_uuid(),b,'click','/',repeat('a',64),'2000-01-01T12:00:00Z');
  begin
    insert into public.banner_events (id,banner_id,event_type,path,ip_hash,created_at) values
      (gen_random_uuid(),a,'click','/news/stories',repeat('a',64),'2000-01-01T14:59:59Z');
    assert false, 'Same banner/IP/KST day must not count twice, even on another page';
  exception when unique_violation then null; end;
  stats := public.banner_stats('1999-12-31T15:00:00Z','2000-01-02T14:59:59Z');
  assert (stats->'totals'->>'impressions')::int = 2;
  assert (stats->'totals'->>'clicks')::int = 4;
  assert stats->'daily'->0->>'date' = '2000-01-01';
  assert (stats->'daily'->0->>'clicks')::int = 3;
  assert (stats->'daily'->1->>'clicks')::int = 1;
  assert jsonb_array_length(stats->'banners') = 2;
  assert not has_table_privilege('anon','public.banner_events','select');
  assert not has_table_privilege('authenticated','public.banner_events','insert');
  assert not has_function_privilege('anon','public.banner_stats(timestamptz,timestamptz)','execute');
  assert (select relrowsecurity from pg_class where oid='public.banner_events'::regclass);
end;
$$;
rollback;
