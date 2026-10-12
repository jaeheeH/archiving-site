import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  const keys: string[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await db.from('user_saved_items').select('kind,item_id').eq('user_id', user.id).order('kind').order('item_id').range(start, start + 499);
    if (error) return Response.json({ error: '저장 상태를 불러오지 못했습니다.' }, { status: 503, headers: { 'Cache-Control':'private, no-store' } });
    keys.push(...(data || []).map(row => `${row.kind}:${row.item_id}`));
    if (!data || data.length < 500) break;
  }
  return Response.json({ keys }, { headers: { 'Cache-Control': 'private, no-store' } });
}
