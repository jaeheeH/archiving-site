import { notFound, permanentRedirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { readNewsArticle } from "@/lib/news";
import { editorialText } from "@/lib/news-editorial";
import { CATEGORIES } from "@/lib/news-feeds";
import type { Metadata } from "next";
import { getBlogPostData } from "@/lib/public-data";
import BlogDetailClient from "@/app/blog/[slug]/BlogDetailClient";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await readNewsArticle(slug);
  const post = article ? null : (await getBlogPostData(slug))?.post;
  const title = article?.title || post?.title;
  const description = article?.description || post?.summary || "ARCH.B의 소식과 에디토리얼";
  const image = `/api/og?type=article&slug=${encodeURIComponent(slug)}`;
  return title ? { title: { absolute: `${title} · ARCH.B` }, description, alternates: { canonical: `/news/read/${slug}` }, openGraph: { type: "article", title, description, url: `/news/read/${slug}`, siteName: "ARCH.B", images: [{ url: image, width: 1200, height: 630 }], publishedTime: article?.published_at || post?.published_at || undefined }, twitter: { card: "summary_large_image", title, description, images: [image] } } : { title: "기사를 찾을 수 없습니다 · ARCH.B" };
}
export default async function ReadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, data] = await Promise.all([readNewsArticle(slug), getBlogPostData(slug)]);
  if (data?.redirectSlug) permanentRedirect(`/news/read/${encodeURIComponent(data.redirectSlug)}`);
  if (!data?.post || !data.post.published_at || (data.post.type !== "blog" && !(data.post.type === "news" && article?.kind === "news"))) notFound();
  const news = article?.kind === "news" ? article : null;
  return <BlogDetailClient
    initialPost={{ ...data.post, userScraped: false }}
    initialCategory={data.category}
    initialAuthorProfile={data.authorProfile}
    initialRelatedPosts={data.relatedPosts}
    news={news ? { categoryName: CATEGORIES[news.category], categoryUrl: `/news/stories?category=${news.category}`, source: news.source, description: news.description, points: news.points, readingMinutes: Math.max(1, Math.ceil(editorialText(news.paragraphs).length / 500)) } : undefined}
  >
    {news && <div className="reading-body">{news.paragraphs.every(p => typeof p === "string") && <h2>어떤 소식인가요?</h2>}{news.paragraphs.map((paragraph, i) => typeof paragraph === "string" ? <p key={i}>{paragraph}</p> : <section className="reading-section" key={i}>{paragraph.kind === "analysis" && <span className="analysis-label">ARCH.B 분석</span>}<h2>{paragraph.heading}</h2>{paragraph.paragraphs.map((text, index) => <p key={index}>{text}</p>)}{paragraph.references.length > 0 && <div className="reading-references">{paragraph.references.map(reference => <a href={reference.url} key={reference.url} target="_blank" rel="noopener noreferrer">{reference.kind === "primary" && <span className="sr-only">공식 1차 자료: </span>}{reference.label}<ExternalLink size={14} /><span className="sr-only"> (새 창)</span></a>)}</div>}</section>)}
      <div className="reading-tags">{news.tags.map(tag => <a href={`/news/stories?q=${encodeURIComponent(tag)}`} key={tag}>{tag}</a>)}</div><section className="source-credit"><h2>출처</h2><p>{news.source}의 원출처와 본문에 표시한 참고자료를 바탕으로 한국어로 재구성했습니다. ‘ARCH.B 분석’은 자료를 읽고 덧붙인 편집 해석입니다.</p><a href={news.url} target="_blank" rel="noopener noreferrer">{news.original_title}<ExternalLink size={15} /><span className="sr-only"> (새 창)</span></a></section></div>}
  </BlogDetailClient>;
}
