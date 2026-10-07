import { checkPostEditPermission } from '@/lib/supabase/post-utils';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertNewsProject, newsWritingQueue, writePendingNews } from '@/lib/news-pipeline';

export const maxDuration = 180;
export async function GET() {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  try {
    assertNewsProject(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    return Response.json(await newsWritingQueue(createAdminClient(), permission), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: '자동 작성 상태를 불러오지 못했습니다.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  try {
    assertNewsProject(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    return Response.json(await writePendingNews(createAdminClient(), permission, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(150_000)]) }), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (cause) { return Response.json({ error: cause instanceof Error ? cause.message : '자동 작성에 실패했습니다.' }, { status: 503 }); }
}
