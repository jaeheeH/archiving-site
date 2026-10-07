-- First-party public-page analytics. No IP, account ID, query string or full referrer.
create table public.site_page_views (
  id uuid primary key,
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  session_hash text not null check (session_hash ~ '^[a-f0-9]{64}$'),
  path text not null check (length(path) between 1 and 512 and path like '/%' and path !~ '[?#]'),
  section text not null check (section in ('홈', '뉴스', '아트', '작가', '참고사이트', '갤러리')),
  referrer_host text check (length(referrer_host) <= 253),
  device text not null check (device in ('desktop', 'mobile', 'tablet')),
  is_entry boolean not null default false,
  created_at timestamptz not null default now()
);
create index site_page_views_time_idx on public.site_page_views (created_at);
create index site_page_views_visitor_time_idx on public.site_page_views (visitor_hash, created_at);
create unique index site_page_views_entry_idx on public.site_page_views (session_hash) where is_entry;
alter table public.site_page_views enable row level security;
revoke all on public.site_page_views from public, anon, authenticated;
grant select, insert, delete on public.site_page_views to service_role;

-- Aggregate inside Postgres so the Data API's row limit cannot truncate traffic.
create function public.site_traffic_stats(p_start timestamptz, p_end timestamptz, p_previous_start timestamptz, p_previous_end timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_start > p_end or p_previous_start > p_previous_end
     or p_previous_end > p_start or p_end - p_previous_start > interval '62 days' then
    raise exception 'Invalid analytics period';
  end if;
  return (
    with records as materialized (
      select * from public.site_page_views where created_at between p_previous_start and p_end
    ), current_period as materialized (
      select * from records where created_at between p_start and p_end
    ), previous_period as (
      select * from records where created_at between p_previous_start and p_previous_end
    ), calendar as (
      select d::date as date from generate_series(
        (p_start at time zone 'Asia/Seoul')::date,
        (p_end at time zone 'Asia/Seoul')::date, interval '1 day') d
    ), daily as (
      select c.date::text as date, count(distinct r.visitor_hash) as visitors,
        count(distinct r.session_hash) as sessions, count(r.id) as pageviews
      from calendar c left join current_period r on (r.created_at at time zone 'Asia/Seoul')::date = c.date
      group by c.date order by c.date
    ), pages as (
      select path, section, count(*) as count, count(distinct visitor_hash) as visitors
      from current_period group by path, section order by count desc, path limit 20
    ), referrers as (
      select coalesce(referrer_host, '직접·출처 없음') as label, count(*) as count
      from current_period where is_entry group by referrer_host order by count desc, label limit 10
    ), devices as (
      select device as label, count(distinct session_hash) as count
      from current_period group by device order by count desc, label
    ), sections as (
      select section as label, count(*) as count from current_period group by section order by count desc, label
    )
    select jsonb_build_object(
      'visitors', (select count(distinct visitor_hash) from current_period),
      'sessions', (select count(distinct session_hash) from current_period),
      'pageviews', (select count(*) from current_period),
      'previousVisitors', (select count(distinct visitor_hash) from previous_period),
      'previousSessions', (select count(distinct session_hash) from previous_period),
      'previousPageviews', (select count(*) from previous_period),
      'trackingSince', (select min(created_at) from public.site_page_views),
      'daily', coalesce((select jsonb_agg(to_jsonb(daily)) from daily), '[]'::jsonb),
      'pages', coalesce((select jsonb_agg(to_jsonb(pages)) from pages), '[]'::jsonb),
      'referrers', coalesce((select jsonb_agg(to_jsonb(referrers)) from referrers), '[]'::jsonb),
      'devices', coalesce((select jsonb_agg(to_jsonb(devices)) from devices), '[]'::jsonb),
      'sections', coalesce((select jsonb_agg(to_jsonb(sections)) from sections), '[]'::jsonb)
    )
  );
end;
$$;
revoke all on function public.site_traffic_stats(timestamptz, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.site_traffic_stats(timestamptz, timestamptz, timestamptz, timestamptz) to service_role;
