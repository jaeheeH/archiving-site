import { redirect } from 'next/navigation';
import { getVisitorAnalytics } from '@/lib/dashboard-data';
import VisitorAnalytics from '../../VisitorAnalytics';
import VisitorPage from './VisitorPage';

export const dynamic = 'force-dynamic';

export default async function VisitorsPage({ searchParams }: { searchParams: Promise<{ days?: string; page?: string; q?: string; session?: string; eventPage?: string }> }) {
  const params = await searchParams;
  const days = [5, 7, 30].includes(Number(params.days)) ? Number(params.days) : 7;
  // Keep existing search and visit-detail bookmarks working after the page split.
  if (['page', 'q', 'session', 'eventPage'].some(key => key in params)) {
    const search = new URLSearchParams({ days: String(days) });
    for (const key of ['page', 'q', 'session', 'eventPage'] as const) {
      if (typeof params[key] === 'string') search.set(key, params[key]);
    }
    redirect(`/dashboard/analytics/visitors/sessions?${search}${params.session ? '#visitor-session-detail' : '#visitor-sessions'}`);
  }
  const traffic = await getVisitorAnalytics(days);
  if (!traffic) redirect('/dashboard');
  return <VisitorPage days={days} section="overview"><VisitorAnalytics traffic={traffic} days={days} /></VisitorPage>;
}
