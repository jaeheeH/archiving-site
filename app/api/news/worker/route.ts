import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertNewsProject } from '@/lib/news-pipeline';
import { authorizeNewsWorker, runNextNewsJob } from '@/lib/news-jobs';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    assertNewsProject(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    const db = createAdminClient({ timeoutMs: 15000 });
    if (!await authorizeNewsWorker(db, request.headers.get('authorization'))) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    after(() => runNextNewsJob(db).then(() => {}));
    return Response.json({ accepted: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: '뉴스 작업 서버를 시작하지 못했습니다.' }, { status: 503 });
  }
}
