import { redirect } from 'next/navigation';
import { getAudienceAnalytics } from '@/lib/dashboard-data';
import { analyticsDays } from '@/lib/engagement';
import EngagementSummary, { MeasurementNote } from '../EngagementSummary';
import VisitorAnalytics from '../../VisitorAnalytics';
import VisitorPage from './VisitorPage';

export const dynamic = 'force-dynamic';

export default async function VisitorsPage({ searchParams }: { searchParams: Promise<{ days?: string; page?: string; q?: string; session?: string; eventPage?: string }> }) {
  const params = await searchParams;
  const days = analyticsDays(params.days);
  // Keep existing search and visit-detail bookmarks working after the page split.
  if (['page', 'q', 'session', 'eventPage'].some(key => key in params)) {
    const search = new URLSearchParams({ days: String(days) });
    for (const key of ['page', 'q', 'session', 'eventPage'] as const) {
      if (typeof params[key] === 'string') search.set(key, params[key]);
    }
    redirect(`/dashboard/analytics/visitors/sessions?${search}${params.session ? '#visitor-session-detail' : '#visitor-sessions'}`);
  }
  const data = await getAudienceAnalytics(days);
  if (!data) redirect('/dashboard');
  return <VisitorPage days={days} section="overview"><VisitorAnalytics traffic={data.traffic} days={days} />{data.error && <p className="operation-warning" role="alert">{data.error}</p>}{data.stats && <><EngagementSummary stats={data.stats} visitors={data.traffic.stats?.visitors || 0} days={days} /><MeasurementNote since={data.stats.since} /></>}</VisitorPage>;
}
