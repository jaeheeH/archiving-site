import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAudienceAnalytics } from '@/lib/dashboard-data';
import { analyticsDays, metricNumber as number, metricRate as rate, metricTime as time } from '@/lib/engagement';
import AnalyticsLayout from '../AnalyticsLayout';
import { MeasurementNote } from '../EngagementSummary';

export const dynamic = 'force-dynamic';
const deviceNames: Record<string,string> = { desktop: '데스크톱', mobile: '모바일', tablet: '태블릿' };
export default async function SearchAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string; q?: string; empty?: string }> }) {
  const params = await searchParams, days = analyticsDays(params.days), data = await getAudienceAnalytics(days);
  if (!data) redirect('/dashboard');
  const stats = data.stats, query = typeof params.q === 'string' ? params.q.trim().slice(0,100) : '', empty = params.empty === '1';
  const keywords = stats?.keywords.filter(row => row.query.toLowerCase().includes(query.toLowerCase()) && (!empty || row.noResults > 0)) || [];
  return <AnalyticsLayout section="search" days={days}>
    {data.error && <p className="operation-warning" role="alert">{data.error}</p>}
    {stats && <>
      <section className="operation-card"><div className="operation-section-heading"><div><h2>검색에서 자료를 찾았나요?</h2><p>사이트 내부 검색 · 결과 클릭 여부로 탐색을 확인합니다.</p></div></div><div className="audience-depth-grid">{[['검색 횟수',`${number(stats.searchCount)}회`],['결과 없는 검색',`${number(stats.noResults)}회 · ${rate(stats.noResults,stats.searchCount)}`],['결과를 클릭한 검색',`${number(stats.searchClicks)}회 · ${rate(stats.searchClicks,stats.searchCount)}`],['감지된 이용 오류',`${number(stats.errors)}건`]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
      <section className="operation-card"><div className="operation-section-heading"><div><h2>내부 검색어</h2><p>검색 횟수 상위 100개 내 검색 · 같은 검색에서 여러 결과를 눌러도 클릭한 검색은 1회</p></div></div>
        <form className="audience-filters" method="get"><input type="hidden" name="days" value={days} /><label className="audience-query">검색어 찾기<input name="q" type="search" defaultValue={query} maxLength={100} placeholder="검색어 일부" /></label><label className="audience-checkbox"><input type="checkbox" name="empty" value="1" defaultChecked={empty} />결과 없는 검색 포함만</label><button className="content-table-action">적용</button>{(query || empty) && <Link className="content-table-action" href={`?days=${days}`}>초기화</Link>}</form>
        {keywords.length ? <div className="operation-table-scroll" role="region" aria-label="내부 검색어 분석" tabIndex={0}><table className="operation-table audience-keyword-table"><thead><tr><th scope="col">검색어</th><th scope="col">검색 위치</th><th scope="col">검색</th><th scope="col">결과 없음</th><th scope="col">클릭한 검색</th></tr></thead><tbody>{keywords.map(row => <tr key={`${row.section}:${row.query}`}><th scope="row"><Link href={`/search?${new URLSearchParams({q:row.query})}`} target="_blank" rel="noopener noreferrer">{row.query}</Link></th><td>{row.section}</td><td>{number(row.searches)}회</td><td>{number(row.noResults)}회</td><td>{number(row.clicked)}회 · {rate(row.clicked,row.searches)}</td></tr>)}</tbody></table></div> : <p className="operation-empty">{query || empty ? '조건에 맞는 검색 기록이 없습니다.' : '아직 기록된 내부 검색이 없습니다.'}</p>}
        <p className="operation-footnote">통합 검색·뉴스·아트·작가·참고사이트에서 실행된 검색을 집계합니다. 외부 검색엔진에서 사용한 검색어는 이 표에 포함되지 않습니다. 연락처·URL·인증정보 형태의 검색어는 기록하지 않습니다.</p>
      </section>
      <div className="operation-charts">
        <section className="operation-card"><div className="operation-section-heading"><div><h2>콘텐츠를 어떻게 이어 보나요?</h2><p>같은 방문에서 실제로 이어진 페이지 조회 · 상위 20개</p></div></div>{stats.transitions.length ? <ol className="audience-journeys">{stats.transitions.map(row => <li key={`${row.from}:${row.to}`}><div><Link href={row.from}>{data.titles[row.from] || row.from}</Link><span aria-hidden="true">→</span><Link href={row.to}>{data.titles[row.to] || row.to}</Link></div><strong>{number(row.count)}회</strong></li>)}</ol> : <p className="operation-empty">이어진 페이지 이동이 쌓이면 표시됩니다.</p>}</section>
        <section className="operation-card"><div className="operation-section-heading"><div><h2>기기별 읽기·이용 경험</h2><p>기기별 본문 측정 조회와 감지된 오류</p></div></div>{stats.devices.length ? <div className="operation-table-scroll" role="region" aria-label="기기별 이용 분석" tabIndex={0}><table className="operation-table audience-device-table"><thead><tr><th scope="col">기기 / 측정</th><th scope="col">활성 읽기</th><th scope="col">깊게 봄</th><th scope="col">오류</th></tr></thead><tbody>{stats.devices.map(row => <tr key={row.device}><th scope="row">{deviceNames[row.device] || row.device}<span className="visitor-cell-meta">{number(row.measured)}건 측정</span></th><td>{time(row.activeSeconds)}</td><td>{rate(row.deepReads,row.measured)}</td><td>{number(row.errors)}</td></tr>)}</tbody></table></div> : <p className="operation-empty">아직 기기별 기록이 없습니다.</p>}</section>
      </div>
      <section className="operation-card"><div className="operation-section-heading"><div><h2>점검할 오류가 있는 페이지</h2><p>최종 이미지 로딩 실패·브라우저 스크립트 오류 · 상위 20개</p></div></div>{stats.errorPages.length ? <div className="operation-table-scroll" role="region" aria-label="페이지별 이용 오류" tabIndex={0}><table className="operation-table"><thead><tr><th scope="col">페이지</th><th scope="col">종류</th><th scope="col">발생 조회</th></tr></thead><tbody>{stats.errorPages.map(row => <tr key={`${row.path}:${row.kind}`}><th scope="row"><Link href={row.path}>{data.titles[row.path] || row.path}</Link></th><td>{row.kind === 'image' ? '이미지 로딩' : row.kind === 'javascript' ? '스크립트' : '화면 오류'}</td><td>{number(row.count)}건</td></tr>)}</tbody></table></div> : <p className="operation-empty">선택 기간에 감지된 오류가 없습니다. 모든 이용 문제를 감지하는 것은 아닙니다.</p>}</section>
      <MeasurementNote since={stats.since} />
    </>}
  </AnalyticsLayout>;
}
