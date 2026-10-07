import "@/app/css/news.css";
import Link from "next/link";
import { readNewsPlacement } from "@/lib/news-placement";
import { readNews, type NewsArticle as Article } from "@/lib/news";
import { CATEGORIES, type Category } from "@/lib/news-feeds";
import { pageMetadata } from '@/lib/seo';
export const metadata = pageMetadata({ path: '/', title: '디자인·AI·기술 뉴스와 아트 아카이브', description: '디자인과 AI, 제품·개발·공간의 새로운 소식과 ARCH.B의 깊이 있는 시선. 작품·작가·참고사이트를 함께 탐색합니다.' });
export const dynamic = "force-dynamic";
const path = (article: Article) => `/news/read/${article.slug}`;
const date = (value: string) => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(value));
const sectionCopy = {
  editorial: { title: "소식을 넘어, 깊이 읽는 시선", description: "작품과 기술, 만드는 사람들의 배경을 읽는 ARCH.B 에디토리얼." },
  design: { title: "형태가 바꾸는 일상", description: "사물과 재료, 새로운 디자인의 가능성." },
  development: { title: "더 나은 것을 만드는 기술", description: "코드와 도구, 만드는 사람들의 다음 선택." },
  interiors: { title: "공간에 담긴 생각", description: "머무는 곳에서 발견하는 새로운 경험." },
  ai: { title: "창작과 일에 스며드는 AI", description: "모델과 도구의 변화, 실제 활용과 확인해야 할 한계." },
  technology: { title: "제품이 바꾸는 다음 일상", description: "새로운 기기와 서비스, 기술이 만드는 경험." },
};
function StoryCard({ article }: { article: Article }) {
  return <article className={`news-card ${!article.image ? "news-card-text" : ""}`}>
    {article.image && <a className="news-card-image" href={path(article)} tabIndex={-1} aria-hidden="true"><img src={article.image} alt="" loading="lazy" referrerPolicy="no-referrer" /></a>}
    <div className="news-card-copy"><p className="news-card-meta">{article.source} <time dateTime={article.published_at}>{date(article.published_at)}</time></p><h3><a href={path(article)}>{article.title}</a></h3><p className="news-card-summary">{article.description}</p><a className="news-card-read" href={path(article)}>기사 읽기<span className="sr-only">: {article.title}</span></a></div>
  </article>;
}
export default async function Home() {
  let articles: Article[] = [];
  let error = false;
  try { articles = (await readNews()).articles; }
  catch (cause) { console.error("Home stories", cause); error = true; }
  const placement = await readNewsPlacement();
  const featured = articles.find(a => a.id === placement.featuredId) ?? articles[0];
  const latest = articles.filter(a => a.url !== featured?.url).slice(0, 4);
  const promoted = new Set([featured?.url, ...latest.map(a => a.url)]);
  const tags = [...new Set(articles.flatMap(a => a.tags))].slice(0, 9);
  const sources = [...new Set(articles.map(a => a.source))];
  return <div className="archb-news">
    <a className="skip-link" href="#news-stories">주요 기사로 바로 가기</a>
    <main id="news-stories"><h1 className="sr-only">ARCH.B 뉴스</h1>
      {error || !featured ? <div className="empty" role={error ? "alert" : "status"}><h2>{error ? "이야기를 불러오지 못했습니다." : "다음 이야기를 준비하고 있습니다."}</h2><a href="/news/stories">모든 기사 보기</a></div> : <div className="news-news-layout"><div className="news-news-main">
        <div className="news-top-heading"><h2>주요 뉴스</h2><a href="/news/stories">전체 보기</a></div>
        <div className="news-top-stories"><article className="news-cover" aria-label="커버 스토리">{featured.image && <a className="news-cover-image" href={path(featured)} tabIndex={-1} aria-hidden="true"><img src={featured.image} alt="" fetchPriority="high" referrerPolicy="no-referrer" /></a>}<div className="news-cover-copy"><div className="news-topic-tags"><a href={`/news/stories?category=${featured.category}`}>{CATEGORIES[featured.category]}</a>{featured.tags.slice(0, 2).map(tag => <a href={`/news/stories?q=${encodeURIComponent(tag)}`} key={tag}>{tag}</a>)}</div><h3><a href={path(featured)}>{featured.title}</a></h3><p className="news-cover-summary">{featured.description}</p><div className="news-cover-bottom"><span>{featured.source} · <time dateTime={featured.published_at}>{date(featured.published_at)}</time></span><a href={path(featured)}>기사 읽기</a></div></div></article>
        <section className="news-latest" aria-label="최신 주요 뉴스">{latest.map(article => <article key={article.url}>{article.image && <a className="news-latest-image" href={path(article)} tabIndex={-1} aria-hidden="true"><img src={article.image} alt="" loading="lazy" referrerPolicy="no-referrer" /></a>}<div><p className="news-latest-meta"><a href={`/news/stories?category=${article.category}`}>{CATEGORIES[article.category]}</a><span>{article.source}</span></p><h3><a href={path(article)}>{article.title}</a></h3><p className="news-latest-summary">{article.description}</p></div></article>)}</section></div>
        {(Object.keys(CATEGORIES) as Category[]).map(category => { const categoryStories = articles.filter(a => a.category === category && a.url !== featured.url); const stories = [...categoryStories.filter(a => !promoted.has(a.url)), ...categoryStories.filter(a => promoted.has(a.url))].slice(0, 3); if (!stories.length) return null; const copy = sectionCopy[category]; return <section className="news-section" key={category}><div className="news-section-heading"><div><p className="news-kicker">{CATEGORIES[category]}</p><h2>{copy.title}</h2><p>{copy.description}</p></div><a href={`/news/stories?category=${category}`}>전체 보기</a></div><div className="news-card-grid">{stories.map(article => <StoryCard article={article} key={article.url} />)}</div></section>; })}
      </div><aside className="news-sidebar" aria-label="뉴스 탐색"><section><h2>분야별 모아보기</h2><p className="news-sidebar-description">{articles.length}편의 뉴스와 에디토리얼</p><div className="news-category-links">{(Object.keys(CATEGORIES) as Category[]).map(category => <a href={`/news/stories?category=${category}`} key={category}><span>{CATEGORIES[category]}</span><strong>{articles.filter(a => a.category === category).length}<small>편</small></strong></a>)}</div></section><section><h2>뉴스 속 키워드</h2><div className="news-keywords">{tags.map(tag => <a href={`/news/stories?q=${encodeURIComponent(tag)}`} key={tag}>{tag}</a>)}</div></section><section><h2>함께 읽는 매체</h2>{sources.map(source => <a className="news-source-link" href={`/news/stories?source=${encodeURIComponent(source)}`} key={source}><span>{source}</span><small>{articles.filter(a => a.source === source).length}편</small></a>)}</section><section className="news-archive-links"><h2>더 깊이 탐색하기</h2><Link href="/art"><span>아트</span><small>작품과 이야기 ↗</small></Link><Link href="/artists"><span>작가</span><small>만드는 사람들 ↗</small></Link><Link href="/references"><span>참고사이트</span><small>관점을 넓히는 곳 ↗</small></Link></section><p className="news-source-note">매체의 소식과 ARCH.B의 작성 글을 함께 읽습니다. 가공 기사는 원출처를, 에디토리얼은 작성자를 본문에 표시합니다.</p></aside></div>}
    </main>
  </div>;
}
