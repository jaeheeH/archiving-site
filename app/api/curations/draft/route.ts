import { after } from 'next/server';
import { z } from 'zod';
import { checkPostEditPermission } from '@/lib/supabase/post-utils';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertNewsProject } from '@/lib/news-pipeline';
import { configureNewsWorker,createCurationJob,getNewsJob,runNextNewsJob } from '@/lib/news-jobs';
export const maxDuration=300;
export async function GET() {
  const permission=await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  try { return Response.json({job:await getNewsJob(createAdminClient(),permission.userId,undefined,'curation')},{headers:{'Cache-Control':'private, no-store'}}); }
  catch { return Response.json({error:'큐레이션 상태를 불러오지 못했습니다.'},{status:503}); }
}
export async function POST(request: Request) {
  const permission=await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  const origin=request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({error:'허용되지 않은 요청입니다.'},{status:403});
  try {
    assertNewsProject(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    const text=await request.text();
    if (text.length>2048) return Response.json({error:'요청이 너무 큽니다.'},{status:413});
    const parsed=z.object({topic:z.string().trim().max(100).default(''),retryId:z.string().uuid().optional()}).strict().safeParse(JSON.parse(text || '{}'));
    if (!parsed.success) return Response.json({error:'주제와 재시도 ID를 확인해주세요.'},{status:400});
    const db=createAdminClient({timeoutMs:15000});
    await configureNewsWorker(db);
    const result=await createCurationJob(db,permission,parsed.data.topic,parsed.data.retryId);
    if (result.created) after(() => runNextNewsJob(db,{jobId:result.job.id}).then(() => {}));
    return Response.json(result,{status:202,headers:{'Cache-Control':'private, no-store'}});
  } catch (cause) { return Response.json({error:cause instanceof Error ? cause.message : '초안 생성에 실패했습니다.'},{status:cause instanceof SyntaxError ? 400 : cause instanceof Error && cause.cause === 409 ? 409 : 503}); }
}
