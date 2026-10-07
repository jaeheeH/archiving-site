-- ARCH.B only. Apply to overgjynkrnwayfammid after verifying management access.
create schema if not exists private;
alter table public.posts add column if not exists like_count integer not null default 0 check (like_count >= 0);

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user_id_idx on public.post_likes(user_id);
alter table public.post_likes enable row level security;
revoke all on public.post_likes from anon, authenticated;
grant select on public.post_likes to authenticated;
grant all on public.post_likes to service_role;
create policy own_likes_read on public.post_likes for select to authenticated using (user_id = (select auth.uid()));

create function private.update_like_count() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  else
    update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
    return old;
  end if;
end;
$$;
revoke all on function private.update_like_count() from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.update_like_count() to service_role;
create trigger post_like_count after insert or delete on public.post_likes for each row execute function private.update_like_count();

create function public.set_post_like(p_post_id uuid, p_user_id uuid, p_liked boolean) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare result_count integer;
begin
  perform 1 from public.posts where id = p_post_id and type in ('news', 'blog') and is_published and published_at is not null for update;
  if not found then raise exception 'Published article not found' using errcode = 'P0002'; end if;
  if p_liked then
    insert into public.post_likes(post_id, user_id) values (p_post_id, p_user_id) on conflict do nothing;
  else
    delete from public.post_likes where post_id = p_post_id and user_id = p_user_id;
  end if;
  select like_count into result_count from public.posts where id = p_post_id;
  return jsonb_build_object('liked', p_liked, 'like_count', result_count);
end;
$$;
revoke all on function public.set_post_like(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_post_like(uuid, uuid, boolean) to service_role;

create table public.artists (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  name text not null check (length(trim(name)) between 1 and 200),
  name_ko text,
  source_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create table public.artworks (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  data jsonb not null check (data->>'id' = id and length(trim(data->>'title')) between 1 and 300),
  updated_at timestamptz not null default now()
);
create table public.artwork_artists (
  artwork_id text not null references public.artworks(id) on delete cascade,
  artist_id text not null references public.artists(id) on delete restrict,
  primary key (artwork_id, artist_id)
);
create index artwork_artists_artist_id_idx on public.artwork_artists(artist_id);
alter table public.artists enable row level security;
alter table public.artworks enable row level security;
alter table public.artwork_artists enable row level security;
revoke all on public.artists, public.artworks, public.artwork_artists from anon, authenticated;
grant select on public.artists, public.artworks, public.artwork_artists to anon, authenticated;
grant all on public.artists, public.artworks, public.artwork_artists to service_role;
create policy artists_public_read on public.artists for select to anon, authenticated using (true);
create policy artworks_public_read on public.artworks for select to anon, authenticated using (true);
create policy artwork_artists_public_read on public.artwork_artists for select to anon, authenticated using (true);

-- Both the artwork and all artist links commit together, including on validation failures.
create function public.save_artwork(p_record jsonb, p_artist_ids text[]) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.artworks(id, data) values (p_record->>'id', p_record - 'artist_ids')
    on conflict(id) do update set data = excluded.data, updated_at = now();
  delete from public.artwork_artists where artwork_id = p_record->>'id';
  insert into public.artwork_artists(artwork_id, artist_id)
    select p_record->>'id', artist_id from (select distinct unnest(p_artist_ids) as artist_id) links;
end;
$$;
revoke all on function public.save_artwork(jsonb, text[]) from public, anon, authenticated;
grant execute on function public.save_artwork(jsonb, text[]) to service_role;

alter table public.site_settings add column if not exists news_featured_post_id uuid references public.posts(id) on delete set null;
alter table public.site_settings add column if not exists news_editor_pick_ids uuid[] not null default '{}' check (cardinality(news_editor_pick_ids) <= 3);
