-- Sourced biographies and curated article links; existing catalog permissions stay in place.
alter table public.artists add column profile jsonb not null default '{}'
  check (jsonb_typeof(profile) = 'object' and octet_length(profile::text) <= 30000);
comment on column public.artists.profile is 'Korean introduction, lifespan/context, primary-source links and related published post IDs. Managed through the authorized catalog API.';
