import Link from 'next/link';
import { ArrowUpRight, Eye, Monitor, MousePointer2, Users } from 'lucide-react';
import { periodChange } from '@/lib/dashboard-metrics';
import type { TrafficStats } from '@/lib/site-traffic';
import TrendChart from './TrendChart';

const number = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value);
const deviceNames: Record<string, string> = { desktop: '데스크톱', mobile: '모바일', tablet: '태블릿' };

function Breakdown({ title, description, items, unit }: { title: string; description: string; items: { label: string; count: number }[]; unit: string }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return <section className="operation-card"><div className="operation-section-heading"><div><h2>{title}</h2><p>{description}</p></div></div>{items.length ? <div className="visitor-breakdown">{items.map(item => <div key={item.label}><div><span>{deviceNames[item.label] || item.label}</span><strong>{number(item.count)}{unit} <small>{number(item.count / total * 100)}%</small></strong></div><progress aria-label={deviceNames[item.label] || item.label} value={item.count} max={total} /></div>)}</div> : <p className="operation-empty">아직 기록된 방문이 없습니다.</p>}</section>;
}

export default function VisitorAnalytics({ traffic, days, compact = false }: { traffic: { stats: TrafficStats | null; error: string | null; period: { previousStart: string } }; days: number; compact?: boolean }) {
  const stats = traffic.stats;
  if (!stats) return <section className="operation-card" id="visitor-analytics"><h2 className="text-base font-semibold">방문자 분석</h2><p className="operation-warning mt-4" role="alert">{traffic.error}</p></section>;
  const pagesPerVisit = stats.sessions ? stats.pageviews / stats.sessions : null;
  const change = (current: number, previous: number, unit: string) => stats.trackingSince && Date.parse(stats.trackingSince) <= Date.parse(traffic.period.previousStart) ? periodChange(current, previous, unit) : '직전 기간 데이터 부족';
  const cards = [
    { label: `최근 ${days}일 방문자`, value: stats.visitors, unit: '명', detail: change(stats.visitors, stats.previousVisitors, '명'), icon: Users },
    { label: '방문 횟수', value: stats.sessions, unit: '회', detail: change(stats.sessions, stats.previousSessions, '회'), icon: MousePointer2 },
    { label: '페이지 조회', value: stats.pageviews, unit: '건', detail: change(stats.pageviews, stats.previousPageviews, '건'), icon: Eye },
    { label: '방문당 조회', value: pagesPerVisit, unit: '페이지', detail: '페이지 조회 ÷ 방문 횟수', icon: Monitor },
  ];
  const topPage = stats.pages[0], topSource = stats.referrers[0], topDevice = stats.devices[0];
  const available = stats.pageviews > 0;
  return <section className="visitor-section" id="visitor-analytics" aria-labelledby="visitor-heading">
    <div className="operation-section-heading"><div><h2 id="visitor-heading">{compact ? '방문자 분석' : '방문 현황'}</h2><p>전체 공개 사이트 기준 · 같은 브라우저의 중복 방문을 구분합니다.</p></div>{compact ? <Link className="operation-pill" href={`/dashboard/analytics/visitors?days=${days}`}>자세히 보기 <ArrowUpRight size={13} /></Link> : <Link className="operation-pill" href="#visitor-sessions">방문 상세 보기 <ArrowUpRight size={13} /></Link>}</div>
    {!available && <p className="visitor-notice">방문 통계 수집을 연결했습니다. 배포 후 공개 사이트 방문부터 표시되며, 과거 방문 기록은 포함되지 않습니다.</p>}
    <div className="operation-kpis visitor-kpis">{cards.map(card => { const Icon = card.icon; return <div key={card.label} className="operation-card kpi-card"><div className="kpi-label"><span>{card.label}</span><span className="operation-icon"><Icon size={17} aria-hidden="true" /></span></div><p className="kpi-number">{number(card.value)}<span>{card.unit}</span></p><p className="kpi-detail">{card.detail}</p></div>; })}</div>
    <div className="operation-charts visitor-charts"><section className="operation-card"><div className="operation-section-heading"><div><h2>일별 방문 추이</h2><p>최근 {days}일 · 날짜마다 방문자를 중복 제외해 집계합니다.</p></div></div><div className="chart-legend"><span><i className="legend-registration" />방문자</span><span><i className="legend-publication" />방문 횟수</span></div><TrendChart daily={stats.daily.map(d => ({ ...d, registered: 0, published: 0, views: d.pageviews }))} mode="visitors" /></section>
      <section className="operation-card"><div className="operation-section-heading"><div><h2>방문 분석</h2><p>선택 기간의 실제 방문 기록에서 확인한 흐름입니다.</p></div></div>{available ? <div className="visitor-insights"><p><strong>가장 많이 본 페이지</strong><Link href={topPage.path}>{topPage.title || topPage.section} <ArrowUpRight size={12} /></Link><span>{number(topPage.count)}건 · 전체 조회의 {number(topPage.count / stats.pageviews * 100)}%</span></p>{topSource && <p><strong>주요 유입</strong><span>{topSource.label} · {number(topSource.count)}회</span></p>}{topDevice && <p><strong>많이 사용하는 기기</strong><span>{deviceNames[topDevice.label]} · 방문의 {number(topDevice.count / stats.sessions * 100)}%</span></p>}</div> : <p className="operation-empty">방문 기록이 쌓이면 주요 유입과 인기 페이지를 분석합니다.</p>}</section></div>
    {!compact && <><div className="operation-secondary"><Breakdown title="유입 경로" description="방문이 시작될 때의 외부 도메인 · 상위 10개 경로 내 비율" items={stats.referrers} unit="회" /><Breakdown title="접속 기기" description="방문 횟수 기준 · 기기 유형별 분포" items={stats.devices} unit="회" /><Breakdown title="섹션별 조회" description="뉴스·아트·작가 등 공개 화면의 조회 분포" items={stats.sections} unit="건" /></div>
      <section className="operation-card"><div className="operation-section-heading"><div><h2>인기 페이지</h2><p>선택 기간 페이지 조회 순 · 상위 20개</p></div></div>{stats.pages.length ? <div className="operation-table-scroll" role="region" aria-label="인기 페이지 표" tabIndex={0}><table className="operation-table visitor-table"><thead><tr><th scope="col">페이지</th><th scope="col">분야</th><th scope="col">방문자</th><th scope="col">조회</th></tr></thead><tbody>{stats.pages.map(page => <tr key={page.path}><th scope="row"><Link href={page.path}>{page.title || page.section}</Link><span className="mt-1">{page.path}</span></th><td>{page.section}</td><td>{number(page.visitors)}</td><td>{number(page.count)}</td></tr>)}</tbody></table></div> : <p className="operation-empty">아직 조회된 페이지가 없습니다.</p>}</section></>}
    <p className="operation-footnote">{stats.trackingSince ? `첫 방문 기록: ${new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(stats.trackingSince))} · ` : ''}방문자는 30일 쿠키로 구분한 브라우저 수이며 실제 사람 수와 다를 수 있습니다. 방문은 30분 동안 활동이 없으면 새로 시작합니다. 기간 방문자는 전체 기간 중복을 제외하므로 일별 합계와 다를 수 있습니다. 관리·로그인·마이페이지, 봇, 추적 거부 및 기본 로컬 접속은 제외합니다.</p>
  </section>;
}
