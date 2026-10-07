import { after } from 'next/server';
import { checkPostEditPermission } from '@/lib/supabase/post-utils';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertNewsProject, newsWritingQueue } from '@/lib/news-pipeline';
import { createNewsJob, getNewsJob } from '@/lib/news-jobs';

export const maxDuration = 3000;
export async function GET() {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  try {
    assertNewsProject(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    return Response.json({ ...await newsWritingQueue(createAdminClient(), permission), job: getNewsJob(permission.userId) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: '자동 작성 상태를 불러오지 못했습니다.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  try {
    assertNewsProject(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    const body = await request.text();
    let limit = 15;
    if (body) {
      try { limit = JSON.parse(body).limit; } catch { return Response.json({ error: '요청 형식을 확인해주세요.' }, { status: 400 }); }
      if (!Number.isInteger(limit) || limit < 1 || limit > 15) return Response.json({ error: '한 번에 1~15편을 작성할 수 있습니다.' }, { status: 400 });
    }
    const db = createAdminClient();
    const queue = await newsWritingQueue(db, permission);
    const { job, run } = createNewsJob(db, permission, { limit });
    if (run) after(run);
    return Response.json({ ...queue, job }, { status: 202, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (cause) { return Response.json({ error: cause instanceof Error ? cause.message : '자동 작성에 실패했습니다.' }, { status: 503 }); }
}
