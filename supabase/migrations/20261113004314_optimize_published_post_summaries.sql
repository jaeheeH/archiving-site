-- Extract summary fields and validate article shape in one pass over the JSON.
CREATE OR REPLACE VIEW public.published_post_summaries WITH (security_invoker = true) AS
select p.id, p.type, p.slug, p.title, p.subtitle, p.summary, p.tags,
  case when p.type::text='news' then coalesce(nullif(p.title_image_url,''),nullif(p.thumbnail_url,'')) else p.title_image_url end as title_image_url,
  p.published_at, p.category_id, c.source, c.source_url, c.source_published_at, c.original_title, c.category as news_category
from public.posts p
left join lateral jsonb_to_record(case when jsonb_typeof(p.content)='object' then p.content end)
  as c(format text, source text, source_url text, source_published_at text, original_title text, category text, paragraphs jsonb, points jsonb) on true
where p.is_published and p.published_at is not null and
  (p.type::text='blog' or (p.type::text='news' and c.format='archb-news-v1'
    and jsonb_typeof(c.paragraphs)='array' and jsonb_typeof(c.points)='array'
    and c.category=any(array['design','development','interiors','ai','technology','editorial'])));
