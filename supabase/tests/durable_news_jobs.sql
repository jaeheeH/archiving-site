begin;
do $$
declare owner_id uuid; job_id uuid; second_id uuid; first_lease uuid; second_lease uuid; claimed integer; stale_rows integer;
begin
  select id into owner_id from public.users where role='admin' order by id limit 1;
  if owner_id is null then raise exception 'An existing ARCH.B admin is required'; end if;
  if exists(select from public.news_jobs where author_id=owner_id and status in ('queued','collecting','writing')) then
    raise exception 'Wait for the existing admin batch before running the isolated rollback test';
  end if;
  insert into public.news_jobs(author_id,state) values(owner_id,'{}') returning id into job_id;
  begin
    insert into public.news_jobs(author_id,state) values(owner_id,'{}');
    raise exception 'Duplicate active batch was accepted';
  exception when unique_violation then null; end;
  select lease_token into first_lease from public.claim_news_job(job_id);
  if first_lease is null then raise exception 'Job was not atomically claimed'; end if;
  select count(*) into claimed from public.claim_news_job(job_id);
  if claimed<>0 then raise exception 'A second worker took an existing lease'; end if;
  update public.news_jobs set lease_until=now()-interval '1 second' where id=job_id;
  select lease_token into second_lease from public.claim_news_job(job_id);
  if second_lease is null or second_lease=first_lease then raise exception 'Interrupted step did not recover with a new lease'; end if;
  update public.news_jobs set status='completed' where id=job_id and lease_token=first_lease;
  get diagnostics stale_rows=row_count;
  if stale_rows<>0 then raise exception 'Stale worker could overwrite progress'; end if;
  update public.news_jobs set lease_until=now()-interval '1 second',lease_attempts=3 where id=job_id;
  perform public.claim_news_job(job_id);
  if (select status from public.news_jobs where id=job_id)<>'failed' then raise exception 'Repeated crashes were not bounded'; end if;
  insert into public.news_jobs(author_id,state) values(owner_id,'{}') returning id into second_id;
  if second_id is null then raise exception 'Terminal job prevented the next batch'; end if;
  if has_table_privilege('anon','public.news_jobs','SELECT') or has_table_privilege('authenticated','public.news_worker_config','SELECT')
    or has_function_privilege('authenticated','public.claim_news_job(uuid)','EXECUTE')
    or has_function_privilege('anon','private.dispatch_news_worker()','EXECUTE') then raise exception 'Private queue or dispatcher is exposed'; end if;
  if not (select relrowsecurity from pg_class where oid='public.news_jobs'::regclass) then raise exception 'Job RLS is missing'; end if;
end;
$$;
rollback;
select 'Durable queue SQL checks passed: duplicate batches, leases, stale completion fencing, crash recovery, bounded retries, RLS and grants.' as result;
