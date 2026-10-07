-- Run against ARCH.B. All reaction changes are rolled back.
begin;
do $$
declare article_id uuid; reader_id uuid; baseline integer; result jsonb;
begin
  if not exists(select 1 from pg_class where oid='public.post_likes'::regclass and relrowsecurity) then raise exception 'Likes RLS disabled'; end if;
  if has_table_privilege('anon','public.post_likes','SELECT') or has_table_privilege('authenticated','public.post_likes','INSERT') or has_table_privilege('authenticated','public.post_likes','DELETE') then raise exception 'Likes grants too broad'; end if;
  if has_function_privilege('anon','public.set_post_like(uuid,uuid,boolean)','EXECUTE') or has_function_privilege('authenticated','public.set_post_like(uuid,uuid,boolean)','EXECUTE') then raise exception 'Like RPC exposed'; end if;
  if not has_table_privilege('authenticated','public.post_likes','SELECT') then raise exception 'Own reaction reads unavailable'; end if;
  if exists(select 1 from pg_class where oid in ('public.artworks'::regclass,'public.artists'::regclass,'public.artwork_artists'::regclass) and not relrowsecurity) then raise exception 'Catalog RLS disabled'; end if;
  if has_table_privilege('anon','public.artworks','INSERT') or has_table_privilege('authenticated','public.artists','UPDATE') or has_table_privilege('authenticated','public.artwork_artists','DELETE') then raise exception 'Catalog write grants too broad'; end if;
  if has_function_privilege('authenticated','public.save_artwork(jsonb,text[])','EXECUTE') then raise exception 'Catalog RPC exposed'; end if;
  select id into article_id from public.posts where type='news' and is_published and published_at is not null order by id limit 1;
  select author_id into reader_id from public.posts where id=article_id;
  perform public.set_post_like(article_id,reader_id,false);
  select like_count into baseline from public.posts where id=article_id;
  result := public.set_post_like(article_id,reader_id,true);
  if (result->>'like_count')::integer <> baseline+1 then raise exception 'Like increment failed'; end if;
  result := public.set_post_like(article_id,reader_id,true);
  if (result->>'like_count')::integer <> baseline+1 then raise exception 'Repeated like was not idempotent'; end if;
  result := public.set_post_like(article_id,reader_id,false);
  result := public.set_post_like(article_id,reader_id,false);
  if (result->>'like_count')::integer <> baseline then raise exception 'Repeated unlike was not idempotent'; end if;
  perform public.set_post_like(article_id,reader_id,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',reader_id,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ begin
  if (select count(*) from public.post_likes where user_id <> auth.uid()) <> 0 then raise exception 'Other accounts likes are visible'; end if;
  if (select count(*) from public.post_likes where user_id=auth.uid()) < 1 then raise exception 'Own likes are not readable'; end if;
  begin
    update public.posts set like_count=like_count+100 where author_id=auth.uid() and type='news';
    raise exception 'A client forged the like counter';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.artworks) < 30 or (select count(*) from public.artists) < 19 then raise exception 'Public catalog read failed'; end if;
end $$;
set local role anon;
do $$ begin
  if (select count(*) from public.artworks) < 30 or (select count(*) from public.artists) < 19 then raise exception 'Anonymous catalog read failed'; end if;
end $$;
reset role;
rollback;
select 'PASS: like add/remove/idempotency, own-account RLS, counter protection, catalog grants; test data rolled back' as verification;
