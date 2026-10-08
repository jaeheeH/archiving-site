-- Detailed analytics remain service-only; existing records intentionally keep null metadata.
alter table public.site_page_views
  add column ip_address inet,
  add column referrer_path text check (length(referrer_path) <= 512 and referrer_path like '/%' and referrer_path !~ '[?#]'),
  add column browser text check (browser in ('Chrome','Edge','Firefox','Safari','Opera','Samsung Internet','기타')),
  add column os text check (os in ('Windows','macOS','iOS','Android','Linux','ChromeOS','기타')),
  add column country_code text check (country_code ~ '^[A-Z]{2}$');
create index site_page_views_session_time_idx on public.site_page_views (session_hash, created_at, id);

create function public.site_traffic_sessions(p_start timestamptz, p_end timestamptz, p_page integer default 1, p_query text default '')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_start is null or p_end is null or p_start > p_end or p_end - p_start > interval '31 days'
    or p_page is null or p_page < 1 or p_page > 10000 or p_query is null or length(p_query) > 100 then
    raise exception 'Invalid visitor query';
  end if;
  return (
    with grouped as (
      select session_hash, visitor_hash, min(created_at) as started_at, max(created_at) as last_at, count(*) as pageviews
      from public.site_page_views where created_at between p_start and p_end group by session_hash, visitor_hash
    ), sessions as materialized (
      select g.*, first.path as entry_path, last.path as last_path, first.referrer_host, first.referrer_path,
        host(coalesce(first.ip_address, last.ip_address)) as ip_address,
        coalesce(first.country_code, last.country_code) as country_code, first.device,
        coalesce(first.browser, last.browser) as browser, coalesce(first.os, last.os) as os
      from grouped g
      cross join lateral (select * from public.site_page_views where session_hash = g.session_hash order by created_at, id limit 1) first
      cross join lateral (select * from public.site_page_views where session_hash = g.session_hash order by created_at desc, id desc limit 1) last
    ), filtered as materialized (
      select * from sessions where p_query = '' or strpos(lower(concat_ws(' ', ip_address, referrer_host, referrer_path, entry_path)), lower(p_query)) > 0
    ), pagination as (
      select count(*) as total, greatest(1, ceil(count(*) / 20.0)::int) as pages from filtered
    ), selected as (
      select * from filtered order by started_at desc, session_hash
      limit 20 offset (least(p_page, (select pages from pagination)) - 1) * 20
    )
    select jsonb_build_object('sessions', coalesce((select jsonb_agg(to_jsonb(selected)) from selected), '[]'::jsonb),
      'total', total, 'page', least(p_page, pages), 'totalPages', pages) from pagination
  );
end;
$$;

create function public.site_traffic_session_events(p_session text, p_start timestamptz, p_end timestamptz, p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_session is null or p_session !~ '^[a-f0-9]{64}$' or p_start is null or p_end is null or p_start > p_end
    or p_end - p_start > interval '31 days' or p_page is null or p_page < 1 or p_page > 10000 then
    raise exception 'Invalid visitor session';
  end if;
  return (
    with records as materialized (
      select id, created_at, path, section, is_entry, referrer_host, referrer_path,
        host(ip_address) as ip_address, country_code, device, browser, os
      from public.site_page_views where session_hash = p_session and created_at between p_start and p_end
    ), pagination as (
      select count(*) as total, greatest(1, ceil(count(*) / 20.0)::int) as pages from records
    ), selected as (
      select * from records order by created_at, id limit 20 offset (least(p_page, (select pages from pagination)) - 1) * 20
    )
    select jsonb_build_object('events', coalesce((select jsonb_agg(to_jsonb(selected)) from selected), '[]'::jsonb),
      'total', total, 'page', least(p_page, pages), 'totalPages', pages) from pagination
  );
end;
$$;
revoke all on function public.site_traffic_sessions(timestamptz, timestamptz, integer, text) from public, anon, authenticated;
revoke all on function public.site_traffic_session_events(text, timestamptz, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.site_traffic_sessions(timestamptz, timestamptz, integer, text) to service_role;
grant execute on function public.site_traffic_session_events(text, timestamptz, timestamptz, integer) to service_role;
