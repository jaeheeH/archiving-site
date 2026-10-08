import Link from "next/link";
import { CATEGORIES } from "@/lib/news-feeds";
import { newsPage, newsListUrl, type NewsSummary } from '@/lib/news-list';
import ContentPagination from '@/app/(dashboard)/components/ContentPagination';
import ArchiveImage from '@/app/components/ArchiveImage';
const date = (value: string) => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(value));
export default function NewsList({ articles, category: initialCategory, query: initialQuery, source, collection, editorPickIds = [], page = 1 }: { editorPickIds?: string[]; articles: NewsSummary[]; page?: number; category?: string; query?: string; source?: string; collection?: string }) {
  const query = initialQuery || "";
  const category = initialCategory && Object.hasOwn(CATEGORIES, initialCategory) ? initialCategory : "all";
  const filterUrl = (name: 'q' | 'category', value: string) => {
    const params = new URLSearchParams();
    for (const [key, item] of Object.entries({ category: category === 'all' ? '' : category, q: query, source, collection, [name]: value === 'all' && name === 'category' ? '' : value })) {
      if (item) params.set(key, item);
    }
    return `/news/stories${params.size ? `?${params}` : ''}`;
  };
  const { articles: filtered, pagination } = newsPage(articles, { category, q: query, source, collection, page });
  const chosen = editorPickIds.flatMap(id => articles.find(a => a.id === id) || []);
  const picks = chosen.length ? chosen : articles.slice(0, 3);
  const tags = [...new Set(articles.flatMap(a => a.tags))].slice(0, 10);
  const sources = [...new Set(articles.map(a => a.source))];
  return <main className="archb-news news-list-page">
    <div className="news-list-intro"><Link href="/" className="news-back">주요 뉴스</Link><h1>뉴스</h1><p>디자인·AI·제품·개발·인테리어의 소식과 ARCH.B 에디토리얼을 함께 읽습니다.</p></div>
    <div className="news-list-layout"><div className="news-list-main">
    <div className="news-list-controls"><nav aria-label="뉴스 분야">{Object.entries({ all: "전체", ...CATEGORIES }).map(([key, label]) => <Link key={key} href={filterUrl('category', key)} aria-current={category === key ? 'page' : undefined} scroll={false}>{label}</Link>)}</nav></div>
    <div className="news-list-caption"><span>{query ? `“${query}” 검색 결과` : collection ? "주제별 에디토리얼" : source ? `${source}의 이야기` : "새롭게 도착한 이야기"}{query && <Link href={filterUrl('q', '')} scroll={false}>검색 초기화</Link>}{(source || collection) && <Link href="/news/stories">모든 기사</Link>}</span><span aria-live="polite">{pagination.total}편</span></div>
    {!filtered.length ? <div className="empty"><h2>검색 결과가 없습니다.</h2><p>다른 분야나 키워드로 찾아보세요.</p></div> : <section aria-label="뉴스 목록">{filtered.map(a => <article className="news-story" key={a.slug}><div className="news-story-copy"><p className="news-story-meta">ARCH.B <span>{CATEGORIES[a.category]}{a.kind === "news" && ` · ${a.source}`}</span></p><h2><Link prefetch={false} href={`/news/read/${a.slug}`}>{a.title}</Link></h2><p className="news-story-summary">{a.description}</p><p className="news-story-meta"><time dateTime={a.published_at}>{date(a.published_at)}</time> · {a.kind === "editorial" ? "에디토리얼" : "한국어 에디트"}</p></div>{a.image && <Link prefetch={false} href={`/news/read/${a.slug}`} className="news-story-image" tabIndex={-1} aria-hidden="true"><ArchiveImage src={a.image} width={240} height={180} sizes="(max-width: 640px) 96px, 144px" alt="" loading="lazy" referrerPolicy="no-referrer" /></Link>}</article>)}</section>}
    <ContentPagination page={pagination.page} totalPages={pagination.totalPages} label="뉴스 페이지 이동" href={page => newsListUrl({ category, q: query, source, collection, page })} />
    </div><aside className="news-sidebar news-list-sidebar" aria-label="추천 기사와 관심 주제">
      <section><h2>에디터의 선택</h2>{picks.map(article => <article className="news-editor-pick" key={article.slug}><p>{CATEGORIES[article.category]} · {article.source}</p><h3><Link prefetch={false} href={`/news/read/${article.slug}`}>{article.title}</Link></h3><time dateTime={article.published_at}>{date(article.published_at)}</time></article>)}</section>
      <section><h2>관심 주제</h2><div className="news-keywords">{tags.map(tag => <Link key={tag} href={filterUrl('q', tag)} scroll={false}>{tag}</Link>)}</div></section>
      <section><h2>함께 읽는 매체</h2>{sources.map(name => <Link className="news-source-link" href={`/news/stories?source=${encodeURIComponent(name)}`} key={name}><span>{name}</span><small>{articles.filter(a => a.source === name).length}편</small></Link>)}</section>
      <p className="news-source-note">가공 기사의 원출처와 에디토리얼 작성자는 각 기사 본문에서 확인할 수 있습니다.</p>
    </aside></div>
  </main>;
}
