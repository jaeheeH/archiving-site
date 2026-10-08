import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getVisitorAnalytics, getVisitorSessions } from '@/lib/dashboard-data';
import VisitorAnalytics from '../../VisitorAnalytics';
import VisitorSessions from '../../VisitorSessions';
import '../../dashboard.css';

export const dynamic = 'force-dynamic';

export default async function VisitorsPage({ searchParams }: { searchParams: Promise<{ days?: string; page?: string; q?: string; session?: string; eventPage?: string }> }) {
  const params = await searchParams;
  const days = [5, 7, 30].includes(Number(params.days)) ? Number(params.days) : 7;
  const page = Math.min(10000, Math.max(1, parseInt(params.page || '1', 10) || 1));
  const eventPage = Math.min(10000, Math.max(1, parseInt(params.eventPage || '1', 10) || 1));
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const session = typeof params.session === 'string' && /^[a-f0-9]{64}$/.test(params.session) ? params.session : '';
  const [traffic, detail] = await Promise.all([getVisitorAnalytics(days), getVisitorSessions(days, { page, query, session, eventPage })]);
  if (!traffic || !detail) redirect('/dashboard');
  return <div className="operations-dashboard"><header className="dashboard-Header operations-header"><div><p className="operation-breadcrumb">통계 / 방문자 분석</p><h1>방문자 분석</h1><p className="operation-subtitle">공개 사이트의 유입과 콘텐츠 탐색 흐름 · 한국 시간</p></div><div className="operation-period"><nav aria-label="통계 기간">{[5, 7, 30].map(n => <Link key={n} href={`/dashboard/analytics/visitors?days=${n}`} aria-current={n === days ? 'page' : undefined}>{n}일</Link>)}</nav><time>{traffic.period.dates[0]} – {traffic.period.today}</time></div></header><main className="dashboard-container operations-main"><VisitorAnalytics traffic={traffic} days={days} /><VisitorSessions data={detail} days={days} page={detail.list?.page || page} query={query} session={session} /></main></div>;
}
