-- Run after deploying the URL Context writer. Preserve articles and source provenance.
begin;

do $$
begin
  if exists (select 1 from public.news_jobs where status in ('queued', 'collecting', 'writing')) then
    raise exception 'Wait for active news jobs to finish before removing legacy search metadata.';
  end if;
end;
$$;

with cleaned as (
  update public.posts
  set content = jsonb_set(content, '{research}', (content->'research') - array['notes', 'queries', 'searchSuggestions'])
  where type = 'news'
    and jsonb_typeof(content->'research') = 'object'
    and (content->'research') ?| array['notes', 'queries', 'searchSuggestions']
  returning id
)
select count(*) as cleaned_news_metadata from cleaned;

commit;
