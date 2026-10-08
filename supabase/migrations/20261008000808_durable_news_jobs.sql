-- Jobs are private server data. A batch checkpoints a bounded queue of article IDs.
create table public.news_jobs (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','collecting','writing','completed','failed')),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  lease_token uuid,
  lease_until timestamptz,
  lease_attempts integer not null default 0 check (lease_attempts >= 0),
  next_run_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index news_jobs_active_author_idx on public.news_jobs (author_id)
  where status in ('queued','collecting','writing');
create index news_jobs_due_idx on public.news_jobs (next_run_at,created_at)
  where status in ('queued','collecting','writing');
create index news_jobs_author_history_idx on public.news_jobs (author_id,created_at desc);
alter table public.news_jobs enable row level security;
revoke all on public.news_jobs from public,anon,authenticated;
grant select,insert,update on public.news_jobs to service_role;

create function public.claim_news_job(p_job_id uuid default null)
returns setof public.news_jobs language plpgsql security invoker set search_path = '' as $$
begin
  -- An abruptly terminated step is recovered after its lease. Bound repeated crashes.
  update public.news_jobs set status='failed', lease_token=null, lease_until=null,
    state=state || jsonb_build_object('error','서버 작업이 반복 중단되었습니다. 저장된 초안은 보존됩니다.','finishedAt',now()), updated_at=now()
  where status in ('queued','collecting','writing') and lease_until < now() and lease_attempts >= 3
    and (p_job_id is null or id=p_job_id);
  return query
    with candidate as (
      select id from public.news_jobs
      where status in ('queued','collecting','writing') and next_run_at <= now()
        and (lease_until is null or lease_until < now()) and (p_job_id is null or id=p_job_id)
      order by next_run_at,created_at limit 1 for update skip locked
    )
    update public.news_jobs j set lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes',
      lease_attempts=j.lease_attempts+1,updated_at=now()
    from candidate c where j.id=c.id returning j.*;
end;
$$;
revoke all on function public.claim_news_job(uuid) from public,anon,authenticated;
grant execute on function public.claim_news_job(uuid) to service_role;

create table public.news_worker_config (
  singleton boolean primary key default true check (singleton),
  endpoint text check (endpoint ~ '^https://(www\.)?archbehind\.com/api/news/worker$'),
  token_sha256 text not null check (token_sha256 ~ '^[a-f0-9]{64}$'),
  enabled boolean not null default false,
  last_dispatch_at timestamptz,
  last_request_id bigint,
  updated_at timestamptz not null default now()
);
alter table public.news_worker_config enable row level security;
revoke all on public.news_worker_config from public,anon,authenticated;
grant select,update on public.news_worker_config to service_role;

-- Generate the dispatch token inside Postgres; plaintext is kept only in Vault.
do $$
declare worker_token text;
begin
  worker_token := encode(extensions.gen_random_bytes(32),'hex');
  perform vault.create_secret(worker_token,'archb_news_worker_token','ARCH.B durable news worker dispatch');
  insert into public.news_worker_config(token_sha256)
    values (encode(extensions.digest(worker_token,'sha256'),'hex'));
end;
$$;

create extension if not exists pg_cron;
create extension if not exists pg_net;

create function private.dispatch_news_worker()
returns bigint language plpgsql security invoker set search_path = '' as $$
declare worker_url text; worker_token text; request_id bigint;
begin
  -- No HTTP invocation or function charge while the queue is empty or leased.
  if not exists(select from public.news_jobs where status in ('queued','collecting','writing')
      and next_run_at <= now() and (lease_until is null or lease_until < now())) then return null; end if;
  select endpoint into worker_url from public.news_worker_config where singleton and enabled;
  if worker_url is null then return null; end if;
  select decrypted_secret into worker_token from vault.decrypted_secrets where name='archb_news_worker_token';
  request_id := net.http_post(url:=worker_url,body:='{}'::jsonb,
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || worker_token),
    timeout_milliseconds:=10000);
  update public.news_worker_config set last_dispatch_at=now(),last_request_id=request_id where singleton;
  return request_id;
end;
$$;
revoke all on function private.dispatch_news_worker() from public,anon,authenticated,service_role;
select cron.schedule('archb-news-worker','* * * * *','select private.dispatch_news_worker();');
