-- Preserve existing plain image links. New paid banners opt in to the AD badge.
alter table public.banners add column kind text not null default 'link' check (kind in ('ad', 'link'));

create table public.banner_events (
  id uuid primary key,
  banner_id uuid not null references public.banners(id) on delete cascade,
  event_type text not null check (event_type in ('impression', 'click')),
  path text not null check (path in ('/', '/news/stories')),
  ip_hash text check (ip_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  occurred_on date generated always as ((created_at at time zone 'Asia/Seoul')::date) stored,
  check ((event_type = 'click' and ip_hash is not null) or (event_type = 'impression' and ip_hash is null))
);
create unique index banner_events_daily_click_idx on public.banner_events (banner_id, occurred_on, ip_hash) where event_type = 'click';
create index banner_events_time_idx on public.banner_events (created_at);
create index banner_events_banner_time_idx on public.banner_events (banner_id, created_at);
alter table public.banner_events enable row level security;
revoke all on public.banner_events from public, anon, authenticated;
grant select, insert, delete on public.banner_events to service_role;

create function public.banner_stats(p_start timestamptz, p_end timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_start is null or p_end is null or p_start > p_end or p_end - p_start > interval '31 days' then
    raise exception 'Invalid banner analytics period';
  end if;
  return (
    with records as materialized (
      select banner_id, event_type, occurred_on from public.banner_events where created_at between p_start and p_end
    ), calendar as (
      select d::date as date from generate_series((p_start at time zone 'Asia/Seoul')::date,
        (p_end at time zone 'Asia/Seoul')::date, interval '1 day') d
    ), daily as (
      select c.date::text as date, count(*) filter (where r.event_type = 'impression') as impressions,
        count(*) filter (where r.event_type = 'click') as clicks
      from calendar c left join records r on r.occurred_on = c.date group by c.date order by c.date
    ), banners as (
      select banner_id as id, count(*) filter (where event_type = 'impression') as impressions,
        count(*) filter (where event_type = 'click') as clicks
      from records group by banner_id order by banner_id
    )
    select jsonb_build_object(
      'totals', jsonb_build_object('impressions', (select count(*) from records where event_type = 'impression'),
        'clicks', (select count(*) from records where event_type = 'click')),
      'daily', coalesce((select jsonb_agg(to_jsonb(daily)) from daily), '[]'::jsonb),
      'banners', coalesce((select jsonb_agg(to_jsonb(banners)) from banners), '[]'::jsonb)
    )
  );
end;
$$;
revoke all on function public.banner_stats(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.banner_stats(timestamptz, timestamptz) to service_role;
