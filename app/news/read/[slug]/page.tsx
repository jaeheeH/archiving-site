import { getPageMetadata } from '@/lib/site-settings';
import { notFound, permanentRedirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
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
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
    breadcrumb([{ name: '홈', path: '/' }, { name: '뉴스', path: '/news/stories' }, { name: post.title, path: `/news/read/${encodeURIComponent(post.slug)}` }]),
    { '@context': 'https://schema.org', '@type': news ? 'NewsArticle' : 'BlogPosting', '@id': `${url}#article`, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, url, headline: post.title, description: news?.description || post.summary || post.subtitle || undefined, inLanguage: 'ko-KR', datePublished: post.published_at, dateModified: post.updated_at, ...(post.title_image_url ? { image: [sitePageUrl(post.title_image_url)] } : {}), author: { '@type': authorProfile ? 'Person' : 'Organization', name: authorProfile?.nickname || authorProfile?.name || 'ARCH.B' }, publisher: { '@id': sitePageUrl('/#publisher') }, articleSection: news ? CATEGORIES[news.category] : data.category?.name || '에디토리얼', keywords: post.tags || [], ...(news ? { citation: [...new Set([news.url, ...news.paragraphs.flatMap(p => typeof p === 'string' ? [] : p.references.map(r => r.url))])] } : {}) },
  ]) }} /><BlogDetailClient key={post.id}
    initialPost={{ ...data.post, content: undefined, userScraped: false }}
    outline={{ headings: extractHeadings(post.content), readingMinutes: Math.max(1, Math.ceil(getNodeText(post.content).replace(/\s+/g, "").length / 600)) }}
    initialCategory={data.category}
    initialAuthorProfile={data.authorProfile}
    initialRelatedPosts={data.relatedPosts}
    news={news ? { categoryName: CATEGORIES[news.category], categoryUrl: `/news/stories?category=${news.category}`, source: news.source, description: news.description, points: news.points, readingMinutes: Math.max(1, Math.ceil(editorialText(news.paragraphs).length / 500)) } : undefined}
  >
    {news && <div className="reading-body">{news.paragraphs.every(p => typeof p === "string") && <h2>어떤 소식인가요?</h2>}{news.paragraphs.map((paragraph, i) => typeof paragraph === "string" ? <p key={i}>{paragraph}</p> : <section className="reading-section" key={i}>{paragraph.kind === "analysis" && <span className="analysis-label">ARCH.B 분석</span>}<h2>{paragraph.heading}</h2>{paragraph.paragraphs.map((text, index) => <p key={index}>{text}</p>)}{paragraph.references.length > 0 && <div className="reading-references">{paragraph.references.map(reference => <a href={reference.url} key={reference.url} target="_blank" rel="noopener noreferrer">{reference.kind === "primary" && <span className="sr-only">공식 1차 자료: </span>}{reference.label}<ExternalLink size={14} /><span className="sr-only"> (새 창)</span></a>)}</div>}</section>)}
      <div className="reading-tags">{news.tags.map(tag => <a href={`/news/stories?q=${encodeURIComponent(tag)}`} key={tag}>{tag}</a>)}</div><section className="source-credit"><h2>출처</h2><p>{news.source}의 원출처와 본문에 표시한 참고자료를 바탕으로 한국어로 재구성했습니다. ‘ARCH.B 분석’은 자료를 읽고 덧붙인 편집 해석입니다.</p><a href={news.url} target="_blank" rel="noopener noreferrer">{news.original_title}<ExternalLink size={15} /><span className="sr-only"> (새 창)</span></a></section></div>}
    {!news && <EditorialContent content={post.content} />}
  </BlogDetailClient></>;
}
