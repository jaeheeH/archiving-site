import { redirect } from 'next/navigation';
import { getSavedPage } from '@/lib/saved-data';
import ActivityTab from '../components/ActivityTab';
import { queryText } from '@/lib/search-text';
export const dynamic = 'force-dynamic';
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; type?: string | string[]; tab?: string | string[]; page?: string | string[] }> }) {
  const params = await searchParams;
  const activity = await getSavedPage({ ...params, type:params.type || params.tab });
  if (!activity) redirect(`/login?redirect=${encodeURIComponent(`/mypage/activity?${new URLSearchParams(Object.fromEntries(Object.entries(params).map(([key,value])=>[key,queryText(value)])))}`)}`);
  return <ActivityTab activity={activity} />;
}
