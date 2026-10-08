import Link from 'next/link';
import ContentPagination from '../components/ContentPagination';
import { publicPage, type VisitorSessionList, type VisitorEventList } from '@/lib/site-traffic';

const date = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));
const deviceNames: Record<string, string> = { desktop: '데스크톱', mobile: '모바일', tablet: '태블릿' };
function PageLink({ path }: { path: string }) {
  return publicPage(path) ? <Link href={path} target="_blank" rel="noopener noreferrer">{path}</Link> : <span>{path}</span>;
}

export default function VisitorSessions({ data, days, page, query, session }: {
  data: { list: VisitorSessionList | null; events: VisitorEventList | null; error: string | null };
  days: number; page: number; query: string; session: string;
}) {
  const href = (target: number, selected = '', eventPage = 1) => {
    const params = new URLSearchParams({ days: String(days) });
    if (target > 1) params.set('page', String(target));
    if (query) params.set('q', query);
    if (selected) params.set('session', selected);
    if (eventPage > 1) params.set('eventPage', String(eventPage));
    return `/dashboard/analytics/visitors?${params}${selected ? '#visitor-session-detail' : '#visitor-sessions'}`;
  };
  return <>
    <section className="operation-card" id="visitor-sessions" aria-labelledby="visitor-sessions-heading">
      <div className="operation-section-heading"><div><h2 id="visitor-sessions-heading">방문 상세 기록</h2><p>최근 {days}일 · 방문별 유입, IP, 접속 환경과 페이지 이동</p></div><span>{data.list?.total ?? '—'}회</span></div>
      <form key={`${days}-${query}`} action="/dashboard/analytics/visitors#visitor-sessions" method="get" className="content-table-filters">
        <input type="hidden" name="days" value={days} />
        <input type="search" name="q" aria-label="방문 상세 검색" placeholder="IP, 유입 도메인·경로, 첫 페이지 검색" defaultValue={query} maxLength={100} />
        <button className="content-table-action">검색</button>
        {query && <Link className="content-table-action" href={`/dashboard/analytics/visitors?days=${days}#visitor-sessions`}>초기화</Link>}
      </form>
      {data.error && <p className="operation-warning" role="alert">{data.error}</p>}
      {data.list?.sessions.length ? <div className="operation-table-scroll" role="region" aria-label="방문 상세 표" tabIndex={0}>
        <table className="operation-table visitor-table visitor-session-table"><thead><tr><th>방문 시각 · 방문자</th><th>유입 경로</th><th>첫 페이지 · 마지막 페이지</th><th>IP · 국가</th><th>접속 환경</th><th>조회</th><th>상세</th></tr></thead><tbody>
          {data.list.sessions.map(visit => <tr key={visit.session_hash}>
            <th scope="row"><time dateTime={visit.started_at}>{date(visit.started_at)}</time><span>마지막 {date(visit.last_at)} · 방문자 {visit.visitor_hash.slice(0, 8)}</span></th>
            <td>{visit.referrer_host || '직접·출처 없음'}{visit.referrer_path && <span className="mt-1 block max-w-[220px] break-all text-xs">{visit.referrer_path}</span>}</td>
            <td><div className="max-w-[260px] break-all"><PageLink path={visit.entry_path} /><span className="mt-1 block text-xs text-[var(--archive-muted)]">마지막 <PageLink path={visit.last_path} /></span></div></td>
            <td><code className="break-all text-xs">{visit.ip_address || '미수집'}</code>{visit.country_code && <span className="mt-1 block text-xs">{visit.country_code}</span>}</td>
            <td>{deviceNames[visit.device] || visit.device}<span className="mt-1 block text-xs">{visit.browser || '브라우저 미수집'} · {visit.os || 'OS 미수집'}</span></td>
            <td>{visit.pageviews}</td>
            <td><Link className="content-table-action" href={href(data.list!.page, visit.session_hash)} aria-label={`${date(visit.started_at)} 방문 이동 경로 보기`}>이동 경로</Link></td>
          </tr>)}
        </tbody></table>
      </div> : data.list && <p className="operation-empty">{query ? '조건에 맞는 방문 기록이 없습니다.' : '아직 기록된 방문이 없습니다.'}</p>}
      {data.list && <ContentPagination label="방문 기록 페이지" page={data.list.page} totalPages={data.list.totalPages} href={target => href(target)} />}
      <p className="operation-footnote">기존 기록의 IP·접속 환경은 복원할 수 없으며 새 기록부터 표시됩니다. IP·국가는 운영 서버가 제공한 값만 사용하고 로컬 접속에서는 미수집으로 표시합니다. 유입 경로는 브라우저가 전달한 범위만 확인하며 검색어·쿼리와 URL 조각은 저장하지 않습니다.</p>
    </section>
    {session && <section className="operation-card" id="visitor-session-detail" aria-labelledby="visitor-session-heading">
      <div className="operation-section-heading"><div><h2 id="visitor-session-heading">방문 이동 경로</h2><p>선택 기간에 기록된 조회 순서 · {data.events?.total ?? '—'}건</p></div><Link className="content-table-action" href={href(page)}>닫기</Link></div>
      {data.events?.events.length ? <div className="operation-table-scroll" role="region" aria-label="방문 이동 경로 표" tabIndex={0}><table className="operation-table visitor-table visitor-event-table"><thead><tr><th>순서</th><th>방문 시각</th><th>페이지</th><th>분야</th><th>IP</th></tr></thead><tbody>
        {data.events.events.map((event, index) => <tr key={event.id}><td>{(data.events!.page - 1) * 20 + index + 1}</td><td><time dateTime={event.created_at}>{date(event.created_at)}</time>{event.is_entry && <span className="mt-1 block text-xs">방문 시작</span>}</td><th scope="row" className="break-all"><PageLink path={event.path} /></th><td>{event.section}</td><td><code className="break-all text-xs">{event.ip_address || '미수집'}</code></td></tr>)}
      </tbody></table></div> : <p className="operation-empty">선택 기간에 해당 방문의 조회 기록이 없습니다.</p>}
      {data.events && <ContentPagination label="이동 경로 페이지" page={data.events.page} totalPages={data.events.totalPages} href={target => href(page, session, target)} />}
    </section>}
  </>;
}
