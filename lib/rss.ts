import "server-only";

import { createPublicClient } from "@/lib/supabase/public";
import { getSiteSettings } from "@/lib/site-settings";
import { getSiteUrl } from "@/lib/site-url";

const RSS_ITEM_LIMIT = 50;

type RssPost = {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  slug: string;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
  title_image_url: string | null;
  thumbnail_url: string | null;
  category_id: string | null;
};

type BlogCategory = {
  id: string;
  name: string;
};

function stripInvalidXmlChars(value: string) {
  return value.replace(
    /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g,
    ""
  );
}

function escapeXml(value: string | null | undefined) {
  return stripInvalidXmlChars(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatRssDate(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

function absoluteUrl(url: string, baseUrl: string) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function buildPostDescription(post: RssPost) {
  return post.summary || post.subtitle || "";
}

export async function getBlogRssXml() {
  const supabase = createPublicClient();
  const settings = await getSiteSettings();
  const baseUrl = getSiteUrl();
  const siteName = settings?.site_name || "Archiving";
  const siteDescription =
    settings?.site_description || "ARCH-B의 최신 블로그 글을 전합니다.";

  const [postsRes, categoriesRes] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, title, subtitle, summary, slug, published_at, created_at, updated_at, title_image_url, thumbnail_url, category_id"
      )
      .eq("type", "blog")
      .eq("is_published", true)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(RSS_ITEM_LIMIT),
    supabase.from("categories").select("id, name").eq("type", "blog"),
  ]);

  if (postsRes.error) {
    console.error("RSS posts 조회 실패:", postsRes.error.message);
  }

  if (categoriesRes.error) {
    console.error("RSS categories 조회 실패:", categoriesRes.error.message);
  }

  const posts = ((postsRes.data || []) as RssPost[]).filter(
    (post) => post.title && post.slug
  );
  const categoryMap = new Map(
    ((categoriesRes.data || []) as BlogCategory[]).map((category) => [
      category.id,
      category.name,
    ])
  );

  const lastBuildDate = formatRssDate(
    posts[0]?.updated_at || posts[0]?.published_at || posts[0]?.created_at
  );

  const items = posts
    .map((post) => {
      const link = `${baseUrl}/blog/${post.slug}`;
      const imageUrl = post.thumbnail_url || post.title_image_url;
      const categoryName = post.category_id
        ? categoryMap.get(post.category_id)
        : null;

      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <description>${escapeXml(buildPostDescription(post))}</description>`,
        `      <pubDate>${formatRssDate(post.published_at || post.created_at)}</pubDate>`,
        categoryName ? `      <category>${escapeXml(categoryName)}</category>` : null,
        imageUrl
          ? `      <media:content url="${escapeXml(absoluteUrl(imageUrl, baseUrl))}" medium="image" />`
          : null,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(`${siteName} Blog`)}</title>
    <link>${escapeXml(`${baseUrl}/blog`)}</link>
    <description>${escapeXml(siteDescription)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${escapeXml(`${baseUrl}/rss.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

export function createRssResponse(xml: string) {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
