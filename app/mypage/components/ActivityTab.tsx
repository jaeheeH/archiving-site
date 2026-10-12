import Link from 'next/link';
import { RESOURCE_LABELS } from '@/lib/resource';
import type { SavedPage } from '@/lib/saved-data';
import ResourceCard from '@/app/components/ResourceCard';
import ContentPagination from '@/app/(dashboard)/components/ContentPagination';
export default function ActivityTab({ activity }: { activity: SavedPage }) {
  const href = (type: string, page = 1) => `/mypage/activity?${new URLSearchParams({ q: activity.q, type, page: String(page) })}`;
  return <section className="resource-page w-full">
    <p className="archive-kicker">다시 꺼내 보는 자료</p><h2 className="mt-3 text-2xl font-semibold">내 활동</h2><p className="mt-3 text-sm text-muted-foreground">저장한 기사·작품·작가·참고사이트·갤러리를 한곳에서 찾습니다.</p>
    <form action="/mypage/activity" className="resource-search-form"><label htmlFor="saved-query" className="sr-only">저장한 자료 검색</label><input id="saved-query" type="search" name="q" defaultValue={activity.q} maxLength={100} placeholder="저장한 자료 검색" /><input type="hidden" name="type" value={activity.type} /><button className="archive-button">검색</button></form>
    <nav className="archive-tabs" aria-label="저장한 자료 종류">{Object.entries({ all:'전체',...RESOURCE_LABELS }).map(([type,label]) => <Link key={type} href={href(type)} aria-current={activity.type === type ? 'page' : undefined}>{label}</Link>)}</nav>
    <div className="archive-caption"><p>저장한 자료 <strong>{activity.total}</strong>개 · 최근 저장순</p><Link href="/mypage/activity">조건 초기화</Link></div>
    {activity.items.length ? <section className="resource-grid" aria-label="저장한 자료">{activity.items.map(item => <ResourceCard key={`${item.type}:${item.id}`} item={item} />)}</section> : <div className="archive-empty"><p>{activity.q ? '조건에 맞는 저장 자료가 없습니다.' : '아직 저장한 자료가 없습니다.'}</p><div className="resource-empty-links"><Link href="/search">자료 찾아보기</Link><Link href="/art">작품 둘러보기</Link></div></div>}
    <ContentPagination page={activity.page} totalPages={activity.totalPages} label="저장한 자료 페이지 이동" href={page => href(activity.type,page)} />
  </section>;
}
