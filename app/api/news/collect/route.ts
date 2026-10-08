import { after } from 'next/server';
import { checkPostEditPermission } from "@/lib/supabase/post-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertNewsProject, newsWritingQueue } from "@/lib/news-pipeline";
import { configureNewsWorker, createNewsJob, runNextNewsJob } from '@/lib/news-jobs';
export const maxDuration = 300;
export async function POST(request: Request) {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  try {
    assertNewsProject(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    const db = createAdminClient({ timeoutMs: 15000 });
    const queue = await newsWritingQueue(db, permission);
    await configureNewsWorker(db);
    const { job, created } = await createNewsJob(db, permission, { withCollection: true });
    if (created) after(() => runNextNewsJob(db, { jobId: job.id }).then(() => {}));
    return Response.json({ ...queue, job }, { status: 202, headers: { 'Cache-Control': 'private, no-store' } });
  }
  catch (cause) { return Response.json({ error: cause instanceof Error ? cause.message : '수집·자동 작성 작업을 시작하지 못했습니다.' }, { status: 503 }); }
}
