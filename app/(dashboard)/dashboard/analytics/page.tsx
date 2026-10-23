import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAudienceAnalytics } from '@/lib/dashboard-data';
import { analyticsDays, metricNumber as number, metricRate as rate } from '@/lib/engagement';
import VisitorAnalytics from '../VisitorAnalytics';
import AnalyticsLayout from './AnalyticsLayout';
import EngagementSummary, { MeasurementNote } from './EngagementSummary';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = analyticsDays((await searchParams).days), data = await getAudienceAnalytics(days);
  if (!data) redirect('/dashboard');
  const stats = data.stats;
  const top = stats?.contents.filter(row => row.measured >= 5).sort((a,b) => b.deepReads / b.measured - a.deepReads / a.measured)[0];
  const missing = stats?.keywords.filter(item => item.noResults > 0).sort((a,b) => b.noResults-a.noResults)[0];
  return <AnalyticsLayout section="overview" days={days}>
    <VisitorAnalytics traffic={data.traffic} days={days} compact />
    {data.error && <p className="operation-warning" role="alert">{data.error}</p>}
    {stats && <><EngagementSummary stats={stats} visitors={data.traffic.stats?.visitors || 0} days={days} />
      <section className="operation-card"><div className="operation-section-heading"><div><h2>다음 운영에 참고할 변화</h2><p>실제 수치에서 확인할 점 · 원인은 콘텐츠와 화면을 함께 살펴보세요.</p></div></div><div className="operation-insights">
        <article><span className="insight-index">01 / 방문</span><h3>어디에서 방문이 시작되나요?</h3><p>주요 유입은 {data.traffic.stats?.referrers[0]?.label || '아직 기록 없음'}입니다. 채널별 유입과 재방문 추이를 같은 기간으로 비교하세요.</p><Link href={`/dashboard/analytics/visitors?days=${days}`}>유입 확인 →</Link></article>
        <article><span className="insight-index">02 / 콘텐츠</span><h3>{top?.title || '읽기 반응을 모으고 있습니다'}</h3><p>{top ? `측정 ${number(top.measured)}건 중 ${number(top.deepReads)}건(${rate(top.deepReads, top.measured)})이 깊게 본 조회입니다. 노출과 저장 반응도 함께 살펴보세요.` : '콘텐츠별 측정 조회가 5건 이상 쌓이면 깊게 본 비율이 높은 콘텐츠를 보여줍니다.'}</p><Link href={`/dashboard/analytics/content?days=${days}`}>콘텐츠 비교 →</Link></article>
        <article><span className="insight-index">03 / 탐색</span><h3>{missing ? `“${missing.query}” 검색 결과를 보완해 보세요` : '검색과 이용 흐름을 확인하세요'}</h3><p>{missing ? `${missing.section}에서 결과 없는 검색 ${number(missing.noResults)}회가 있었습니다. 관련 콘텐츠·태그·동의어를 점검할 단서입니다.` : `결과 없는 검색 ${number(stats.noResults)}회, 감지된 오류 ${number(stats.errors)}건입니다. 한 페이지에서 나간 것만으로 불편했다고 판단하지 않습니다.`}</p><Link href={`/dashboard/analytics/search?days=${days}`}>검색·이용 확인 →</Link></article>
      </div></section><MeasurementNote since={stats.since} /></>}
  </AnalyticsLayout>;
}
