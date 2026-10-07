import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getVisitorAnalytics } from '@/lib/dashboard-data';
import VisitorAnalytics from '../../VisitorAnalytics';
import '../../dashboard.css';

export const dynamic = 'force-dynamic';

export default async function VisitorsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const params = await searchParams;
  const days = [5, 7, 30].includes(Number(params.days)) ? Number(params.days) : 7;
  const traffic = await getVisitorAnalytics(days);
  if (!traffic) redirect('/dashboard');
  return <div className="operations-dashboard"><header className="dashboard-Header operations-header"><div><p className="operation-breadcrumb">통계 / 방문자 분석</p><h1>방문자 분석</h1><p className="operation-subtitle">공개 사이트의 유입과 콘텐츠 탐색 흐름 · 한국 시간</p></div><div className="operation-period"><nav aria-label="통계 기간">{[5, 7, 30].map(n => <Link key={n} href={`/dashboard/analytics/visitors?days=${n}`} aria-current={n === days ? 'page' : undefined}>{n}일</Link>)}</nav><time>{traffic.period.dates[0]} – {traffic.period.today}</time></div></header><main className="dashboard-container operations-main"><VisitorAnalytics traffic={traffic} days={days} /></main></div>;
}
