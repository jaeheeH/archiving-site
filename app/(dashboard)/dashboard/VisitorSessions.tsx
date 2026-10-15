import Link from 'next/link';
import ContentPagination from '../components/ContentPagination';
import { publicPage, type VisitorSessionList, type VisitorEventList } from '@/lib/site-traffic';

const date = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));
const deviceNames: Record<string, string> = { desktop: '데스크톱', mobile: '모바일', tablet: '태블릿' };
function PageLink({ path, titles }: { path: string; titles: Record<string, string> }) {
  const label = titles[path] || publicPage(path)?.label || path;
  return publicPage(path) ? <Link className="visitor-page-title" href={path} target="_blank" rel="noopener noreferrer" title={`${label}\n${path} (새 탭)`}>{label}</Link> : <span>{path}</span>;
}

export default function VisitorSessions({ data, days, page, query, session }: {
  data: { list: VisitorSessionList | null; events: VisitorEventList | null; error: string | null; pageTitles: Record<string, string> };
  days: number; page: number; query: string; session: string;
}) {
  const href = (target: number, selected = '', eventPage = 1) => {
    const params = new URLSearchParams({ days: String(days) });
    if (target > 1) params.set('page', String(target));
    if (query) params.set('q', query);
    if (selected) params.set('session', selected);
    if (eventPage > 1) params.set('eventPage', String(eventPage));
    return `/dashboard/analytics/visitors/sessions?${params}${selected ? '#visitor-session-detail' : '#visitor-sessions'}`;
  };
  return <>
    <section className="operation-card" id="visitor-sessions" aria-labelledby="visitor-sessions-heading">
      <div className="operation-section-heading"><div><h2 id="visitor-sessions-heading">방문 상세 기록</h2><p>최근 {days}일 · 최신 방문 순 · 시작과 마지막 페이지를 확인하세요.</p></div><span className="operation-pill">{data.list?.total ?? '—'}회 방문</span></div>
      <form key={`${days}-${query}`} action="/dashboard/analytics/visitors/sessions#visitor-sessions" method="get" className="content-table-filters visitor-search">
        <input type="hidden" name="days" value={days} />
        <input type="search" name="q" aria-label="방문 상세 검색" placeholder="IP, 유입 도메인·경로, 첫 페이지 검색" defaultValue={query} maxLength={100} />
        <button className="content-table-action">검색</button>
        {query && <Link className="content-table-action" href={`/dashboard/analytics/visitors/sessions?days=${days}#visitor-sessions`}>초기화</Link>}
      </form>
      {data.error && <p className="operation-warning" role="alert">{data.error}</p>}
      <p className="visitor-scroll-hint">표를 좌우로 밀어 방문 정보와 이동 경로를 확인하세요.</p>
      {data.list?.sessions.length ? <div className="operation-table-scroll" role="region" aria-label="방문 상세 표" tabIndex={0}>
        <table className="operation-table visitor-table visitor-session-table"><thead><tr><th scope="col">방문 시각 · 방문자</th><th scope="col">유입 경로</th><th scope="col">페이지 이동</th><th scope="col">접속 환경 · IP</th><th scope="col">조회 · 상세</th></tr></thead><tbody>
          {data.list.sessions.map(visit => <tr key={visit.session_hash}>
            <th scope="row"><time dateTime={visit.started_at}>{date(visit.started_at)}</time><span className="visitor-cell-meta">마지막 {date(visit.last_at)}</span><span className="visitor-cell-meta">방문자 <code>{visit.visitor_hash.slice(0, 8)}</code></span></th>
            <td><span className="visitor-source">{visit.referrer_host || '직접·출처 없음'}</span>{visit.referrer_path && <span className="visitor-cell-meta visitor-page-path" title={visit.referrer_path}>{visit.referrer_path}</span>}</td>
            <td><div className="visitor-journey"><span className="visitor-step">시작</span><PageLink path={visit.entry_path} titles={data.pageTitles} /><span className="visitor-step">마지막</span><PageLink path={visit.last_path} titles={data.pageTitles} /></div></td>
            <td>{deviceNames[visit.device] || visit.device}<span className="visitor-cell-meta">{visit.browser || '브라우저 미수집'} · {visit.os || 'OS 미수집'}</span><span className="visitor-cell-meta"><code>{visit.ip_address || 'IP 미수집'}</code>{visit.country_code && ` · ${visit.country_code}`}</span></td>
            <td><strong className="visitor-session-views">{visit.pageviews}<small>회 조회</small></strong><Link className="content-table-action" href={href(data.list!.page, visit.session_hash)} aria-label={`${date(visit.started_at)} 방문 이동 경로 보기`} aria-current={session === visit.session_hash ? 'true' : undefined}>이동 경로</Link></td>
          </tr>)}
        </tbody></table>
      </div> : data.list && <p className="operation-empty">{query ? '조건에 맞는 방문 기록이 없습니다.' : '아직 기록된 방문이 없습니다.'}</p>}
      {data.list && <div className="visitor-table-footer"><p>{data.list.total ? (data.list.page - 1) * 20 + 1 : 0}–{Math.min(data.list.page * 20, data.list.total)} / {data.list.total}회 방문</p><ContentPagination label="방문 기록 페이지" page={data.list.page} totalPages={data.list.totalPages} href={target => href(target)} /></div>}
      <p className="operation-footnote">기존 기록의 IP·접속 환경은 복원할 수 없으며 새 기록부터 표시됩니다. IP·국가는 운영 서버가 제공한 값만 사용하고 로컬 접속에서는 미수집으로 표시합니다. 유입 경로는 브라우저가 전달한 범위만 확인하며 검색어·쿼리와 URL 조각은 저장하지 않습니다.</p>
    </section>
    {session && <section className="operation-card" id="visitor-session-detail" aria-labelledby="visitor-session-heading">
      <div className="operation-section-heading"><div><h2 id="visitor-session-heading">방문 이동 경로</h2><p>선택 기간에 기록된 조회 순서 · {data.events?.total ?? '—'}건</p></div><Link className="content-table-action" href={href(page)}>닫기</Link></div>
      {data.events?.events.length ? <div className="operation-table-scroll" role="region" aria-label="방문 이동 경로 표" tabIndex={0}><table className="operation-table visitor-table visitor-event-table"><thead><tr><th scope="col">순서</th><th scope="col">방문 시각</th><th scope="col">페이지</th><th scope="col">분야</th><th scope="col">IP</th></tr></thead><tbody>
        {data.events.events.map((event, index) => <tr key={event.id}><td>{(data.events!.page - 1) * 20 + index + 1}</td><td><time dateTime={event.created_at}>{date(event.created_at)}</time>{event.is_entry && <span className="visitor-cell-meta">방문 시작</span>}</td><th scope="row"><PageLink path={event.path} titles={data.pageTitles} /><span className="visitor-cell-meta">{event.path}</span></th><td>{event.section}</td><td><code className="break-all text-xs">{event.ip_address || '미수집'}</code></td></tr>)}
      </tbody></table></div> : <p className="operation-empty">선택 기간에 해당 방문의 조회 기록이 없습니다.</p>}
      {data.events && <ContentPagination label="이동 경로 페이지" page={data.events.page} totalPages={data.events.totalPages} href={target => href(page, session, target)} />}
    </section>}
  </>;
}
