import DashboardView from './DashboardView';

export const dynamic = 'force-dynamic';

export default function DashboardMain({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  return <DashboardView searchParams={searchParams} />;
}
