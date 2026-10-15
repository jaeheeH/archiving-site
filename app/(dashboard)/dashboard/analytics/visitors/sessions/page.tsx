import { redirect } from 'next/navigation';
import { getVisitorSessions } from '@/lib/dashboard-data';
import VisitorSessions from '../../../VisitorSessions';
import VisitorPage from '../VisitorPage';

export const dynamic = 'force-dynamic';

export default async function VisitorSessionsPage({ searchParams }: { searchParams: Promise<{ days?: string; page?: string; q?: string; session?: string; eventPage?: string }> }) {
  const params = await searchParams;
  const days = [5, 7, 30].includes(Number(params.days)) ? Number(params.days) : 7;
  const page = Math.min(10000, Math.max(1, parseInt(params.page || '1', 10) || 1));
  const eventPage = Math.min(10000, Math.max(1, parseInt(params.eventPage || '1', 10) || 1));
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const session = typeof params.session === 'string' && /^[a-f0-9]{64}$/.test(params.session) ? params.session : '';
  const detail = await getVisitorSessions(days, { page, query, session, eventPage });
  if (!detail) redirect('/dashboard');
  return <VisitorPage days={days} section="sessions"><VisitorSessions data={detail} days={days} page={detail.list?.page || page} query={query} session={session} /></VisitorPage>;
}
