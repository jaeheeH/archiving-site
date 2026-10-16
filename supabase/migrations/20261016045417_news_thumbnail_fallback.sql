-- Original news images remain authoritative; separately uploaded thumbnails fill missing list images.
-- Preserve existing filters, column order, privileges and caller RLS.
CREATE OR REPLACE VIEW public.published_post_summaries WITH (security_invoker = true) AS
 SELECT id,
    type,
    slug,
    title,
    subtitle,
    summary,
    tags,
    CASE WHEN type::text = 'news'::text THEN COALESCE(NULLIF(title_image_url, ''), NULLIF(thumbnail_url, '')) ELSE title_image_url END AS title_image_url,
    published_at,
    category_id,
    content ->> 'source'::text AS source,
    content ->> 'source_url'::text AS source_url,
    content ->> 'source_published_at'::text AS source_published_at,
    content ->> 'original_title'::text AS original_title,
    content ->> 'category'::text AS news_category
   FROM posts
  WHERE is_published AND published_at IS NOT NULL AND (type::text = 'blog'::text OR type::text = 'news'::text AND (content ->> 'format'::text) = 'archb-news-v1'::text AND jsonb_typeof(content -> 'paragraphs'::text) = 'array'::text AND jsonb_typeof(content -> 'points'::text) = 'array'::text AND ((content ->> 'category'::text) = ANY (ARRAY['design'::text, 'development'::text, 'interiors'::text, 'ai'::text, 'technology'::text, 'editorial'::text])));

CREATE OR REPLACE VIEW public.user_saved_items WITH (security_invoker = true) AS
 SELECT user_id,
    kind,
    item_id,
    title,
    description,
    url,
    image,
    source,
    tags,
    saved_at,
    lower(regexp_replace(NORMALIZE((((((title::text || ' '::text) || description) || ' '::text) || source) || ' '::text) || array_to_string(tags, ' '::text), NFKC), '\s'::text, ''::text, 'g'::text)) AS search_text
   FROM ( SELECT s.user_id,
            'post'::text AS kind,
            p.id::text AS item_id,
            p.title,
            COALESCE(p.summary, p.subtitle::text, ''::text) AS description,
            '/news/read/'::text || p.slug::text AS url,
            CASE WHEN p.type::text = 'news'::text THEN COALESCE(NULLIF(p.title_image_url, ''), NULLIF(p.thumbnail_url, '')) ELSE p.title_image_url END AS image,
            COALESCE(p.content ->> 'source'::text, 'ARCH.B'::text) AS source,
            COALESCE(p.tags, '{}'::text[]) AS tags,
            s.created_at AS saved_at
           FROM post_scraps s
             JOIN posts p ON p.id = s.post_id
          WHERE p.is_published AND p.published_at IS NOT NULL
        UNION ALL
         SELECT s.user_id,
            'gallery'::text,
            g.id::text AS id,
            g.title,
            COALESCE(g.description, g.gemini_description, ''::text) AS "coalesce",
            '/gallery/'::text || g.id,
            COALESCE(g.thumbnail_url, g.image_url) AS "coalesce",
            'ARCH.B 갤러리'::text,
            COALESCE(g.tags, '{}'::text[]) AS "coalesce",
            s.created_at
           FROM gallery_scraps s
             JOIN gallery g ON g.id = s.gallery_id
        UNION ALL
         SELECT s.user_id,
            'reference'::text,
            r.id::text AS id,
            r.title,
            COALESCE(r.description, ''::text) AS "coalesce",
            r.url,
            COALESCE(r.image_url, r.logo_url) AS "coalesce",
            r.url,
            COALESCE(r.range, '{}'::text[]) AS "coalesce",
            s.created_at
           FROM reference_scraps s
             JOIN "references" r ON r.id = s.reference_id
        UNION ALL
         SELECT s.user_id,
            'artwork'::text,
            w.id,
            COALESCE(w.data ->> 'title_ko'::text, w.data ->> 'title'::text) AS "coalesce",
            concat_ws(' · '::text, ( SELECT string_agg(COALESCE(a.name_ko, a.name), ' · '::text) AS string_agg
                   FROM artwork_artists l
                     JOIN artists a ON a.id = l.artist_id
                  WHERE l.artwork_id = w.id), w.data ->> 'date'::text, COALESCE(w.data ->> 'medium_ko'::text, w.data ->> 'medium'::text), w.data ->> 'title'::text, w.data ->> 'artist'::text) AS concat_ws,
            '/art/'::text || w.id,
            w.data ->> 'preview_url'::text,
            COALESCE(w.data ->> 'museum'::text, ''::text) AS "coalesce",
            ARRAY( SELECT jsonb_array_elements_text(COALESCE(w.data -> 'themes'::text, '[]'::jsonb)) AS jsonb_array_elements_text) AS "array",
            s.created_at
           FROM artwork_scraps s
             JOIN artworks w ON w.id = s.artwork_id
        UNION ALL
         SELECT s.user_id,
            'artist'::text,
            a.id,
            COALESCE(a.name_ko, a.name) AS "coalesce",
            concat_ws(' · '::text, a.name, a.profile ->> 'description'::text) AS concat_ws,
            '/artists/'::text || a.id,
            ( SELECT w.data ->> 'preview_url'::text
                   FROM artwork_artists l
                     JOIN artworks w ON w.id = l.artwork_id
                  WHERE l.artist_id = a.id
                  ORDER BY w.id
                 LIMIT 1),
            'ARCH.B 작가 아카이브'::text,
            ARRAY[COALESCE(a.profile ->> 'context'::text, ''::text)] AS "array",
            s.created_at
           FROM artist_scraps s
             JOIN artists a ON a.id = s.artist_id) items;
