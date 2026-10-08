import { after } from 'next/server';
import { checkPostEditPermission } from '@/lib/supabase/post-utils';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertNewsProject, newsWritingQueue } from '@/lib/news-pipeline';
import { configureNewsWorker, createNewsJob, getNewsJob, runNextNewsJob } from '@/lib/news-jobs';
import { isUuidParam } from '@/lib/route-params';

export const maxDuration = 300;
export async function GET() {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  try {
    assertNewsProject(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    const db = createAdminClient({ timeoutMs: 15000 });
    const [queue, job] = await Promise.all([newsWritingQueue(db, permission), getNewsJob(db, permission.userId)]);
    return Response.json({ ...queue, job }, { headers: { 'Cache-Control': 'private, no-store' } });
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
    let retryPostId: string | undefined;
    if (body.length > 4096) return Response.json({ error: '요청 크기를 확인해주세요.' }, { status: 413 });
    if (body) {
      try {
        const input = JSON.parse(body);
        if (input?.postId !== undefined) {
          if (typeof input.postId !== 'string' || !isUuidParam(input.postId)) return Response.json({ error: '뉴스 ID를 확인해주세요.' }, { status: 400 });
          retryPostId = input.postId.toLowerCase();
        } else limit = input?.limit;
      } catch { return Response.json({ error: '요청 형식을 확인해주세요.' }, { status: 400 }); }
      if (!Number.isInteger(limit) || limit < 1 || limit > 15) return Response.json({ error: '한 번에 1~15편을 작성할 수 있습니다.' }, { status: 400 });
    }
    const db = createAdminClient({ timeoutMs: 15000 });
    const queue = await newsWritingQueue(db, permission);
    await configureNewsWorker(db);
    const { job, created } = await createNewsJob(db, permission, { limit, retryPostId });
    if (created) after(() => runNextNewsJob(db, { jobId: job.id }).then(() => {}));
    return Response.json({ ...queue, job }, { status: 202, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (cause) { return Response.json({ error: cause instanceof Error ? cause.message : '자동 작성에 실패했습니다.' }, { status: cause instanceof Error && cause.cause === 409 ? 409 : 503 }); }
}
