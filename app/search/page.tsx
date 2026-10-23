import Link from 'next/link';
import { getSearchResources, searchPage } from '@/lib/search-data';
import { RESOURCE_LABELS } from '@/lib/resource';
import { getPageMetadata } from '@/lib/site-settings';
import ResourceCard from '@/app/components/ResourceCard';
import ContentPagination from '@/app/(dashboard)/components/ContentPagination';
export const dynamic = 'force-dynamic';
export async function generateMetadata() { return getPageMetadata({ path: '/search', title: '통합 검색', description: '기사·작품·작가·참고사이트·갤러리를 함께 찾습니다.', noindex: true }); }
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; type?: string | string[]; page?: string | string[] }> }) {
  const result = searchPage(await getSearchResources(), await searchParams);
  const href = (type: string, page = 1) => `/search?${new URLSearchParams({ q: result.q, type, page: String(page) })}`;
  return <main className="archb-archive resource-page" data-analytics-query={result.q} data-analytics-results={result.total} data-analytics-scope={result.type}>
    <header className="archive-heading"><span className="archive-kicker">새로운 연결을 찾다</span><h1>통합 검색</h1><p>기사와 작품, 만드는 사람과 참고 자료를 함께 탐색합니다.</p></header>
    <form className="resource-search-form" action="/search"><label className="sr-only" htmlFor="resource-query">통합 검색어</label><input id="resource-query" name="q" type="search" maxLength={100} defaultValue={result.q} placeholder="이름, 주제, 재료로 찾아보세요" /><input type="hidden" name="type" value={result.type} /><button className="archive-button">검색</button></form>
    <nav className="archive-tabs" aria-label="검색 결과 종류">{Object.entries({ all: '전체', ...RESOURCE_LABELS }).map(([type, label]) => <Link key={type} href={href(type)} aria-current={result.type === type ? 'page' : undefined}>{label} <small>{result.counts[type]}</small></Link>)}</nav>
    <div className="archive-caption"><p>{result.q ? `“${result.q}” 검색 결과` : '전체 자료'} · <strong>{result.total}</strong>개</p><Link href="/search">조건 초기화</Link></div>
    {result.items.length ? <section className="resource-grid" aria-label="검색 결과">{result.items.map(item => <ResourceCard key={`${item.type}:${item.id}`} item={item} />)}</section> : <div className="archive-empty"><p>조건에 맞는 자료가 없습니다. 검색어를 줄이거나 다른 종류에서도 찾아보세요.</p><div className="resource-empty-links"><Link href={href('all')}>모든 종류에서 찾기</Link><Link href="/art">작품 둘러보기</Link><Link href="/news/stories">뉴스 읽기</Link></div></div>}
    <ContentPagination page={result.page} totalPages={result.totalPages} label="검색 결과 페이지 이동" href={page => href(result.type, page)} />
  </main>;
}
