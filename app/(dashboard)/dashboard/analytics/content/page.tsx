import { redirect } from 'next/navigation';
import { getAudienceAnalytics } from '@/lib/dashboard-data';
import { analyticsDays } from '@/lib/engagement';
import AnalyticsLayout from '../AnalyticsLayout';
import ContentAnalytics from './ContentAnalytics';
import { MeasurementNote } from '../EngagementSummary';

export const dynamic = 'force-dynamic';
export default async function ContentPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = analyticsDays((await searchParams).days), data = await getAudienceAnalytics(days);
  if (!data) redirect('/dashboard');
  return <AnalyticsLayout section="content" days={days}>
    {data.error && <p className="operation-warning" role="alert">{data.error}</p>}
    {data.stats && <ContentAnalytics stats={data.stats} launches={data.launches} />}
    {data.launchError && <p className="operation-warning" role="alert">{data.launchError}</p>}
    <MeasurementNote since={data.stats?.since || null} />
  </AnalyticsLayout>;
}
