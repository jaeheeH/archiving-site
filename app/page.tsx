import { getCurationCategory } from '@/lib/curation';
import "@/app/css/news.css";
import Link from "next/link";
import { readNewsPlacement } from "@/lib/news-placement";
import { readNewsSummaries } from "@/lib/news";
import type { NewsSummary as Article } from '@/lib/news-list';
import ArchiveImage from '@/app/components/ArchiveImage';
import NewsSidebarBanner from '@/app/components/NewsSidebarBanner';
import NewsSuggestion from '@/app/components/NewsSuggestion';
import HomeArtSection from '@/app/components/HomeArtSection';
import HomeReferenceSection from '@/app/components/HomeReferenceSection';
import HomeNewsSidebar from '@/app/components/HomeNewsSidebar';
import { getNewsSidebarBanner } from '@/lib/public-data';
import { CATEGORIES, type Category } from "@/lib/news-categories";
import { getPageMetadata } from '@/lib/site-settings';
export async function generateMetadata() { return getPageMetadata({ path: '/', title: '디자인·AI·기술 뉴스와 아트 아카이브', description: '디자인과 AI, 제품·개발·공간의 새로운 소식과 ARCH.B의 깊이 있는 시선. 작품·작가·참고사이트를 함께 탐색합니다.' }); }
export const dynamic = "force-dynamic";
const path = (article: Article) => `/news/read/${article.slug}`;
const dateFormat = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });
const date = (value: string) => dateFormat.format(new Date(value));
function StoryCard({ article }: { article: Article }) {
  return <article className={`news-card ${!article.image ? "news-card-text" : ""}`}>
    {article.image && <a className="news-card-image" href={path(article)} tabIndex={-1} aria-hidden="true"><ArchiveImage width={640} height={420} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 320px" src={article.image} alt="" loading="lazy" referrerPolicy="no-referrer" /></a>}
    <div className="news-card-copy"><p className="news-card-meta">{article.source} <time dateTime={article.published_at}>{date(article.published_at)}</time></p><h3><a href={path(article)}>{article.title}</a></h3><p className="news-card-summary">{article.description}</p><a className="news-card-read" href={path(article)}>기사 읽기<span className="sr-only">: {article.title}</span></a></div>
  </article>;
}
function StoryRow({ article }: { article: Article }) {
  return <article className="news-topic-story">
    <div><h3><Link prefetch={false} href={path(article)} title={article.title}>{article.title}</Link></h3>{article.description && <p className="news-topic-summary">{article.description}</p>}</div>
    {article.image && <Link prefetch={false} href={path(article)} className="news-topic-image" tabIndex={-1} aria-hidden="true"><ArchiveImage src={article.image} alt="" width={160} height={128} sizes="80px" loading="lazy" referrerPolicy="no-referrer" /></Link>}
    <p className="news-card-meta"><span>{article.source}</span><time dateTime={article.published_at}>{date(article.published_at)}</time></p>
  </article>;
}
export default async function Home() {
  let articles: Article[] = [];
  let error = false;
  let curationCategory: string | undefined;
  let placement: Awaited<ReturnType<typeof readNewsPlacement>>;
  let banner: Awaited<ReturnType<typeof getNewsSidebarBanner>> = null;
  try { const [news, result, ad, category] = await Promise.all([readNewsSummaries(), readNewsPlacement(), getNewsSidebarBanner(), getCurationCategory()]); articles = news.articles; placement = result; banner = ad; curationCategory=category; }
  catch (cause) { console.error("Home stories", cause); error = true; }
  placement ??= { featuredId: null, editorPickIds: [] };
  const featured = articles.find(a => a.id === placement.featuredId) ?? articles[0];
  const latest = articles.filter(a => a.url !== featured?.url).slice(0, 4);
  const promoted = new Set([featured?.url, ...latest.map(a => a.url)]);
  const curationCandidates = articles
    .filter(article => curationCategory && article.collection === curationCategory && !promoted.has(article.url))
    .slice(0, 3);
  const curations = curationCandidates.length >= 2 ? curationCandidates : [];
  const tags = [...new Set(articles.flatMap(a => a.tags))].slice(0, 9);
  return <div className="archb-news">
    <a className="skip-link" href="#news-stories">주요 기사로 바로 가기</a>
    <main id="news-stories"><h1 className="sr-only">ARCH.B 기사와 아카이브</h1>
      <section className="news-news-layout" aria-label="주요 뉴스와 탐색"><div className="news-news-main">
        {error || !featured ? <div className="empty" role={error ? "alert" : "status"}><h2>{error ? "이야기를 불러오지 못했습니다." : "다음 이야기를 준비하고 있습니다."}</h2><a href="/news/stories">모든 기사 보기</a></div> : <>
        <div className="news-top-heading"><h2>주요 뉴스</h2><a href="/news/stories" aria-label="뉴스 전체 보기">전체 보기</a></div>
        <div className="news-top-stories"><article className="news-cover" aria-label="커버 스토리">{featured.image && <a className="news-cover-image" href={path(featured)} tabIndex={-1} aria-hidden="true"><ArchiveImage width={1200} height={800} sizes="(max-width: 768px) 100vw, 480px" src={featured.image} alt="" preload referrerPolicy="no-referrer" /></a>}<div className="news-cover-copy"><div className="news-topic-tags"><a href={`/news/stories?category=${featured.category}`}>{CATEGORIES[featured.category]}</a>{featured.tags.slice(0, 2).map(tag => <a href={`/news/stories?q=${encodeURIComponent(tag)}`} key={tag}>{tag}</a>)}</div><h3><a href={path(featured)}>{featured.title}</a></h3><p className="news-cover-summary">{featured.description}</p><div className="news-cover-bottom"><span>{featured.source} · <time dateTime={featured.published_at}>{date(featured.published_at)}</time></span><a href={path(featured)}>기사 읽기</a></div></div></article>
        <section className="news-latest" aria-label="최신 주요 뉴스">{latest.map(article => <article key={article.url}>{article.image && <a className="news-latest-image" href={path(article)} tabIndex={-1} aria-hidden="true"><ArchiveImage width={640} height={420} sizes="75px" src={article.image} alt="" loading="lazy" referrerPolicy="no-referrer" /></a>}<div><p className="news-latest-meta"><a href={`/news/stories?category=${article.category}`}>{CATEGORIES[article.category]}</a><span>{article.source}</span></p><h3><a href={path(article)}>{article.title}</a></h3><p className="news-latest-summary">{article.description}</p></div></article>)}</section></div></>}
      </div><HomeNewsSidebar>
        <section><h2>뉴스 속 키워드</h2><div className="news-keywords">{tags.map(tag => <a href={`/news/stories?q=${encodeURIComponent(tag)}`} key={tag}>{tag}</a>)}</div></section>
        <NewsSidebarBanner banner={banner} />
        <section className="news-archive-links">
          <h2>더 깊이 탐색하기</h2>
          <Link href="/art"><span>아트</span><small>작품과 이야기 ↗</small></Link>
          <Link href="/artists"><span>작가</span><small>만드는 사람들 ↗</small></Link>
          <Link href="/references"><span>참고사이트</span><small>관점을 넓히는 곳 ↗</small></Link>
          <NewsSuggestion />
        </section>
        <p className="news-source-note">매체의 소식과 ARCH.B의 작성 글을 함께 읽습니다. 가공 기사는 원출처를, 에디토리얼은 작성자를 본문에 표시합니다.</p>
      </HomeNewsSidebar></section>
      {!!curations.length && <section className="news-section" aria-labelledby="curation-section"><div className="news-section-heading"><h2 id="curation-section">주제로 이어보기</h2><Link href={`/news/stories?collection=${curationCategory}`} aria-label="주제별 글 전체 보기">전체 보기</Link></div><div className="news-card-grid">{curations.map(article => <StoryCard key={article.id} article={article} />)}</div></section>}
      <div className="news-topic-sections">{(Object.keys(CATEGORIES) as Category[]).map(category => { const categoryStories = articles.filter(a => a.category === category && a.url !== featured?.url && !curations.some(c => c.id === a.id)); const stories = [...categoryStories.filter(a => !promoted.has(a.url)), ...categoryStories.filter(a => promoted.has(a.url))].slice(0, 3); if (!stories.length) return null; return <section className="news-section news-topic-section" key={category} aria-labelledby={`home-news-${category}`}><div className="news-section-heading"><h2 id={`home-news-${category}`}>{CATEGORIES[category]}</h2><Link href={`/news/stories?category=${category}`} aria-label={`${CATEGORIES[category]} 전체 보기`}>전체 보기</Link></div><div className="news-topic-list">{stories.map(article => <StoryRow article={article} key={article.url} />)}</div></section>; })}</div>
      <HomeArtSection />
      <HomeReferenceSection />
    </main>
  </div>;
}
