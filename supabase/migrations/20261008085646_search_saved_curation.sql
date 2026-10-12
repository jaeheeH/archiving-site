create table public.artwork_scraps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  artwork_id text not null references public.artworks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, artwork_id)
);
create table public.artist_scraps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  artist_id text not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, artist_id)
);
alter table public.artwork_scraps enable row level security;
alter table public.artist_scraps enable row level security;
grant select,insert,delete on public.artwork_scraps,public.artist_scraps to authenticated;
grant all on public.artwork_scraps,public.artist_scraps to service_role;
create policy own_artwork_scraps_read on public.artwork_scraps for select to authenticated using ((select auth.uid())=user_id);
create policy own_artwork_scraps_insert on public.artwork_scraps for insert to authenticated with check ((select auth.uid())=user_id);
create policy own_artwork_scraps_delete on public.artwork_scraps for delete to authenticated using ((select auth.uid())=user_id);
create policy own_artist_scraps_read on public.artist_scraps for select to authenticated using ((select auth.uid())=user_id);
create policy own_artist_scraps_insert on public.artist_scraps for insert to authenticated with check ((select auth.uid())=user_id);
create policy own_artist_scraps_delete on public.artist_scraps for delete to authenticated using ((select auth.uid())=user_id);
drop policy "Anyone can view gallery_scraps" on public.gallery_scraps;
drop policy "Anyone can view reference_scraps" on public.reference_scraps;
create policy own_gallery_scraps_read on public.gallery_scraps for select to authenticated using ((select auth.uid())=user_id);
create policy own_reference_scraps_read on public.reference_scraps for select to authenticated using ((select auth.uid())=user_id);

create view public.published_post_summaries with (security_invoker=true) as
select id,type,slug,title,subtitle,summary,tags,title_image_url,published_at,category_id,
  content->>'source' as source,content->>'source_url' as source_url,
  content->>'source_published_at' as source_published_at,
  content->>'original_title' as original_title,content->>'category' as news_category
from public.posts
where is_published and published_at is not null and (
  type='blog' or (type='news' and content->>'format'='archb-news-v1'
    and jsonb_typeof(content->'paragraphs')='array' and jsonb_typeof(content->'points')='array'
    and content->>'category' in ('design','development','interiors','ai','technology','editorial'))
);
grant select on public.published_post_summaries to anon,authenticated,service_role;

create view public.user_saved_items with (security_invoker=true) as
select user_id,kind,item_id,title,description,url,image,source,tags,saved_at,
  lower(regexp_replace(normalize(title||' '||description||' '||source||' '||array_to_string(tags,' '),NFKC),'\s','','g')) as search_text
from (
  select s.user_id,'post'::text as kind,p.id::text as item_id,p.title,
    coalesce(p.summary,p.subtitle,'') as description,'/news/read/'||p.slug as url,
    p.title_image_url as image,coalesce(p.content->>'source','ARCH.B') as source,
    coalesce(p.tags,'{}'::text[]) as tags,s.created_at as saved_at
  from public.post_scraps s join public.posts p on p.id=s.post_id where p.is_published and p.published_at is not null
  union all
  select s.user_id,'gallery',g.id::text,g.title,coalesce(g.description,g.gemini_description,''),'/gallery/'||g.id,
    coalesce(g.thumbnail_url,g.image_url),'ARCH.B 갤러리',coalesce(g.tags,'{}'::text[]),s.created_at
  from public.gallery_scraps s join public.gallery g on g.id=s.gallery_id
  union all
  select s.user_id,'reference',r.id::text,r.title,coalesce(r.description,''),r.url,
    coalesce(r.image_url,r.logo_url),r.url,coalesce(r.range,'{}'::text[]),s.created_at
  from public.reference_scraps s join public.references r on r.id=s.reference_id
  union all
  select s.user_id,'artwork',w.id,coalesce(w.data->>'title_ko',w.data->>'title'),
    concat_ws(' · ',(select string_agg(coalesce(a.name_ko,a.name),' · ') from public.artwork_artists l join public.artists a on a.id=l.artist_id where l.artwork_id=w.id),w.data->>'date',coalesce(w.data->>'medium_ko',w.data->>'medium'),w.data->>'title',w.data->>'artist'),
    '/art/'||w.id,w.data->>'preview_url',coalesce(w.data->>'museum',''),
    array(select jsonb_array_elements_text(coalesce(w.data->'themes','[]'::jsonb))),s.created_at
  from public.artwork_scraps s join public.artworks w on w.id=s.artwork_id
  union all
  select s.user_id,'artist',a.id,coalesce(a.name_ko,a.name),concat_ws(' · ',a.name,a.profile->>'description'),
    '/artists/'||a.id,(select w.data->>'preview_url' from public.artwork_artists l join public.artworks w on w.id=l.artwork_id where l.artist_id=a.id order by w.id limit 1),
    'ARCH.B 작가 아카이브',array[coalesce(a.profile->>'context','')],s.created_at
  from public.artist_scraps s join public.artists a on a.id=s.artist_id
) items;
grant select on public.user_saved_items to authenticated,service_role;

insert into public.categories(name,slug,type,order_index)
select '주제 큐레이션','curation','blog',coalesce((select max(order_index)+1 from public.categories where type='blog'),0)
where not exists(select 1 from public.categories where type='blog' and slug='curation');
