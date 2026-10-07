-- Account clients cannot forge the denormalized public reaction count.
create or replace function private.protect_post_like_count()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') and
     ((tg_op = 'INSERT' and new.like_count <> 0) or
      (tg_op = 'UPDATE' and new.like_count is distinct from old.like_count)) then
    raise exception 'Like counts are maintained by the reaction service' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger protect_post_like_count before insert or update on public.posts
for each row execute function private.protect_post_like_count();
