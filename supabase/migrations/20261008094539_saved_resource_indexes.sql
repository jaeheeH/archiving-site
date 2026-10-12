create index artwork_scraps_artwork_idx on public.artwork_scraps(artwork_id);
create index artist_scraps_artist_idx on public.artist_scraps(artist_id);
create index post_scraps_user_saved_idx on public.post_scraps(user_id,created_at desc);
create index gallery_scraps_user_saved_idx on public.gallery_scraps(user_id,created_at desc);
create index reference_scraps_user_saved_idx on public.reference_scraps(user_id,created_at desc);
