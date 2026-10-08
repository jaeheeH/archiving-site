import "server-only";
import { unstable_cache, revalidateTag, revalidatePath } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { FEEDS, CATEGORIES } from "./news-feeds";
import { editorialBatchSchema, type Editorial } from "./news-editorial";
import { checkPostOwnershipOrAdmin } from "./supabase/post-utils";
import { NEWS_FORMAT, newsSlug, completedNewsWriting, type NewsArticle } from "./news-record";
export type { NewsArticle } from "./news-record";
import type { NewsSummary } from './news-list';
import { cache } from 'react';
export const NEWS_CACHE_TAG = "archb-news";
const columns = "id,type,slug,title,subtitle,summary,tags,title_image_url,published_at,content,author_id,category_id";

type PublishedRow = {
  id: string; type: string; slug: string; title: string; subtitle: string | null; summary: string | null;
  tags: string[] | null; title_image_url: string | null; published_at: string; category_id: string;
  content: { format?: string; category: NewsArticle["category"]; source_url: string; original_title: string; source: string; source_published_at?: string; paragraphs: NewsArticle["paragraphs"]; points: string[] } | null;
};
export function mapPublishedRows(rows: PublishedRow[]) {
  return rows.flatMap<NewsArticle>(row => {
    if (row.type === "blog") return [{ id: row.id, slug: row.slug, kind: "editorial" as const, collection: row.category_id, url: `/news/read/${row.slug}`, original_title: row.title, title: row.title, summary: row.summary || row.subtitle || "", description: row.summary || row.subtitle || "ARCH.B의 관점으로 읽는 이야기.", tags: row.tags || [], image: row.title_image_url, published_at: row.published_at, source: "ARCH.B", category: "editorial" as const, paragraphs: [], points: [] }];
    const content = row.content;
    if (content?.format !== NEWS_FORMAT || !Object.hasOwn(CATEGORIES, content.category) || !Array.isArray(content.paragraphs) || !Array.isArray(content.points)) return [];
    return [{ id: row.id, slug: row.slug, kind: "news" as const, url: content.source_url, original_title: content.original_title, title: row.title, summary: row.summary || "", description: row.summary || "", tags: row.tags || [], image: row.title_image_url, published_at: content.source_published_at || row.published_at, source: content.source, category: content.category, paragraphs: content.paragraphs, points: content.points }];
  });
}
export const readNews = unstable_cache(async () => {
  const articles: NewsArticle[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await createPublicClient().from('posts').select(columns).in('type', ['news', 'blog']).eq('is_published', true).not('published_at', 'is', null).order('published_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (error) throw error;
    articles.push(...mapPublishedRows((data || []) as PublishedRow[]));
    if (!data || data.length < 500) break;
  }
  articles.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || a.id.localeCompare(b.id));
  return { articles, sources: [...FEEDS, { id: "archb-editorial", name: "ARCH.B", category: "editorial" as const, url: "/" }].map(feed => ({ ...feed, count: articles.filter(a => a.source === feed.name).length })) };
}, ["archb-published-news-and-editorials-v3", JSON.stringify(FEEDS)], { revalidate: 600, tags: [NEWS_CACHE_TAG, "public-posts"] });
export const readNewsSummaries = cache(async (): Promise<{ articles: NewsSummary[] }> => {
  const { articles } = await readNews();
  return { articles: articles.map(article => ({ id: article.id, slug: article.slug, kind: article.kind, collection: article.collection, url: article.url, original_title: article.original_title, title: article.title, summary: article.summary, description: article.description, tags: article.tags, image: article.image, published_at: article.published_at, source: article.source, category: article.category })) };
});
export const readNewsArticle = unstable_cache(async (slug: string) => {
  const { data, error } = await createPublicClient().from("posts").select(columns).eq("slug", slug).in("type", ["news", "blog"]).eq("is_published", true).not("published_at", "is", null).maybeSingle();
  if (error) throw error;
  return data ? mapPublishedRows([data as PublishedRow])[0] || null : null;
}, ["archb-article-by-slug"], { revalidate: 600, tags: [NEWS_CACHE_TAG, "public-posts"] });

export async function collectNews(authorId: string) {
  const { collectNewsInto } = await import('./news-pipeline');
  return collectNewsInto(createAdminClient(), authorId);
}
type Permission = { authorized: true; userId: string; role: string; error: null };
export async function pendingNews(permission: Permission) {
  const db = createAdminClient();
  let query = db.from("posts").select("title,summary,content", { count: "exact" }).eq("type", "news").eq("is_published", false).order("created_at", { ascending: false }).limit(20);
  if (permission.role === "editor") query = query.eq("author_id", permission.userId);
  if (permission.role === "sub-admin") {
    const admins = await db.from("users").select("id").eq("role", "admin");
    if (admins.error) throw admins.error;
    if (admins.data?.length) query = query.not("author_id", "in", `(${admins.data.map(user => user.id).join(",")})`);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  return { pending: count || 0, articles: (data || []).filter(row => row.content?.format === NEWS_FORMAT).map(row => ({ url: row.content.source_url, title: row.title, description: row.summary, source_text: row.content.source_text || "", category: row.content.category, source: row.content.source, published_at: row.content.source_published_at })) };
}
export async function saveNewsEditorials(articles: Editorial[], permission: Permission) {
  editorialBatchSchema.parse({ articles });
  const db = createAdminClient();
  const { data, error } = await db.from("posts").select(columns).eq("type", "news").in("slug", articles.map(a => newsSlug(a.url)));
  if (error) throw error;
  if (data?.length !== articles.length) throw new Error("수집된 뉴스만 가공할 수 있습니다.");
  const permissions = await Promise.all(data.map(row => checkPostOwnershipOrAdmin(row.id, permission)));
  if (permissions.some(permission => !permission.authorized)) throw new Error("가공할 권한이 없는 기사가 포함되어 있습니다.");
  const rows = articles.map(article => { const row = data.find(r => r.slug === newsSlug(article.url))!; return { id: row.id, author_id: row.author_id, type: "news", slug: row.slug, title: article.title, summary: article.summary, tags: article.tags, title_image_url: row.title_image_url, is_published: true, published_at: row.content.source_published_at, content: { ...row.content, source_text: undefined, paragraphs: article.paragraphs, points: article.points, duplicate_review: undefined, automation: completedNewsWriting(row.content.automation) } }; });
  const saved = await db.from("posts").upsert(rows, { onConflict: "id" });
  if (saved.error) throw saved.error;
  revalidateTag(NEWS_CACHE_TAG, { expire: 0 });
  revalidateTag("public-posts", { expire: 0 });
  revalidateTag("public-home", { expire: 0 });
  for (const path of ["/", "/news/stories", "/rss.xml", "/sitemap.xml", ...rows.map(row => `/news/read/${row.slug}`)]) revalidatePath(path);
  return { saved: articles.length };
}
