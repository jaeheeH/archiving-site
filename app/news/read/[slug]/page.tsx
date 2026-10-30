import { getPageMetadata } from '@/lib/site-settings';
import { notFound, permanentRedirect } from "next/navigation";
import { mapPublishedRows } from "@/lib/news";
import { editorialText } from "@/lib/news-editorial";
import { CATEGORIES } from "@/lib/news-feeds";
import type { Metadata } from "next";
import { getBlogPostData } from "@/lib/public-data";
import BlogDetailClient from "@/app/blog/[slug]/BlogDetailClient";
import { cache } from 'react';
import { jsonLd, breadcrumb, sitePageUrl } from '@/lib/seo';
import { extractHeadings, getNodeText } from '@/lib/article-outline';
import EditorialContent from '@/app/components/EditorialContent';
import { NewsBody } from '../NewsBody';
export const dynamic = "force-dynamic";
const getArticleData = cache(async (slug: string) => {
  const data = await getBlogPostData(slug);
  const article = data?.post ? mapPublishedRows([data.post])[0] : null;
  if (data?.redirectSlug) permanentRedirect(`/news/read/${encodeURIComponent(data.redirectSlug)}`);
  if (!data?.post || !data.post.published_at || (data.post.type !== 'blog' && !(data.post.type === 'news' && article?.kind === 'news'))) notFound();
  return { article, ...data };
});
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { article, post, authorProfile } = await getArticleData(slug);
  const title = post.title;
  const description = article?.description || post.summary || post.subtitle || 'ARCH.B의 소식과 에디토리얼';
  const image = `/api/og?type=article&slug=${encodeURIComponent(post.slug)}&v=2-${encodeURIComponent(post.updated_at || post.published_at)}`;
  const metadata = await getPageMetadata({ path: `/news/read/${encodeURIComponent(post.slug)}`, title, description, image });
  return { ...metadata, authors: [{ name: authorProfile?.nickname || authorProfile?.name || 'ARCH.B' }], openGraph: { ...metadata.openGraph, type: 'article', publishedTime: post.published_at, modifiedTime: post.updated_at, tags: post.tags || [], authors: [authorProfile?.nickname || authorProfile?.name || 'ARCH.B'] } };
}
export default async function ReadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getArticleData(slug);
  const { article, post, authorProfile } = data;
  const news = article?.kind === "news" ? article : null;
  const url = sitePageUrl(`/news/read/${encodeURIComponent(post.slug)}`);
  const authorName = authorProfile?.nickname || authorProfile?.name || 'ARCH.B';
  const brandAuthor = !authorProfile || /^arch[.\-\s]?b$/i.test(authorName);
  const image = post.title_image_url || `/api/og?type=article&slug=${encodeURIComponent(post.slug)}&v=2-${encodeURIComponent(post.updated_at || post.published_at)}`;
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
    breadcrumb([{ name: '홈', path: '/' }, { name: '뉴스', path: '/news/stories' }, { name: post.title, path: `/news/read/${encodeURIComponent(post.slug)}` }]),
    { '@context': 'https://schema.org', '@type': news ? 'NewsArticle' : 'BlogPosting', '@id': `${url}#article`, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, url, headline: post.title, description: news?.description || post.summary || post.subtitle || undefined, inLanguage: 'ko-KR', datePublished: post.published_at, dateModified: post.updated_at, image: [sitePageUrl(image)], author: { '@type': brandAuthor ? 'Organization' : 'Person', name: authorName, ...(brandAuthor ? { '@id': sitePageUrl('/#publisher'), url: sitePageUrl('/') } : {}) }, publisher: { '@id': sitePageUrl('/#publisher') }, articleSection: news ? CATEGORIES[news.category] : data.category?.name || '에디토리얼', keywords: post.tags || [], ...(news ? { citation: [...new Set([news.url, ...news.paragraphs.flatMap(p => typeof p === 'string' ? [] : p.references.map(r => r.url))])] } : {}) },
  ]) }} /><BlogDetailClient key={post.id}
    initialPost={{ ...data.post, content: undefined, userScraped: false }}
    outline={{ headings: extractHeadings(post.content), readingMinutes: Math.max(1, Math.ceil(getNodeText(post.content).replace(/\s+/g, "").length / 600)) }}
    initialCategory={data.category}
    initialAuthorProfile={data.authorProfile}
    initialRelatedPosts={data.relatedPosts}
    news={news ? { categoryName: CATEGORIES[news.category], categoryUrl: `/news/stories?category=${news.category}`, source: news.source, imageCredit: typeof post.content?.title_image_credit === 'string' ? post.content.title_image_credit : undefined, description: news.description, points: news.points, readingMinutes: Math.max(1, Math.ceil(editorialText(news.paragraphs).length / 500)) } : undefined}
  >
    {news && <NewsBody news={news} />}
    {!news && <EditorialContent content={post.content} />}
  </BlogDetailClient></>;
}
