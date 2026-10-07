import { createHash } from "node:crypto";
import type { Article } from "./news-feeds";
import { editorialSchema, type Editorial } from "./news-editorial";

export const NEWS_FORMAT = "archb-news-v1";
export const newsSlug = (url: string) => `news-${createHash("sha256").update(url).digest("hex").slice(0, 20)}`;
export type NewsArticle = Article & Editorial & { id: string; slug: string; original_title: string; kind: "news" | "editorial"; collection?: string };
export function newsPost(article: Article & Partial<Editorial> & { original_title?: string }) {
  const published = editorialSchema.safeParse({ url: article.url, title: article.title, summary: article.summary, tags: article.tags, paragraphs: article.paragraphs, points: article.points }).success;
  return { type: "news", slug: newsSlug(article.url), title: article.title, summary: article.summary || article.description, tags: article.tags, title_image_url: article.image, is_published: published, published_at: published ? article.published_at : null,
    content: { format: NEWS_FORMAT, source_url: article.url, source: article.source, category: article.category, source_published_at: article.published_at, original_title: article.original_title || article.title, ...(published ? { paragraphs: article.paragraphs, points: article.points } : { source_text: article.source_text || article.description }) },
  };
}
export type NewsPost = ReturnType<typeof newsPost> & { id: string; author_id: string | null; created_at: string; updated_at: string; view_count: number; scrap_count: number; content: { paragraphs?: Editorial["paragraphs"]; points?: string[]; source_text?: string } };
