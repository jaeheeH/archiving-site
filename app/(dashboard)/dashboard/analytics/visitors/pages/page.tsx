import { redirect } from 'next/navigation';
import { getVisitorAnalytics } from '@/lib/dashboard-data';
import VisitorPopularPages from '../../../VisitorPopularPages';
import VisitorPage from '../VisitorPage';
import { analyticsDays } from '@/lib/engagement';

export const dynamic = 'force-dynamic';

export default async function VisitorPopularPagesPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const params = await searchParams;
  const days = analyticsDays(params.days);
  const traffic = await getVisitorAnalytics(days);
  if (!traffic) redirect('/dashboard');
  return <VisitorPage days={days} section="pages">{traffic.stats
    ? <VisitorPopularPages key={days} pages={traffic.stats.pages} pageviews={traffic.stats.pageviews} />
    : <section className="operation-card"><p className="operation-warning" role="alert">{traffic.error}</p></section>}
  </VisitorPage>;
}
