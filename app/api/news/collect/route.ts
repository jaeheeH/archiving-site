import { checkPostEditPermission } from "@/lib/supabase/post-utils";
import { collectNews } from "@/lib/news";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertNewsProject, writePendingNews } from "@/lib/news-pipeline";
export const maxDuration = 180;
export async function POST(request: Request) {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  try {
    assertNewsProject(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    const collection = await collectNews(permission.userId);
    try {
      const writing = await writePendingNews(createAdminClient(), permission, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(150_000)]) });
      return Response.json({ ...collection, writing });
    } catch (cause) {
      return Response.json({ ...collection, error: `원문 수집 결과는 저장되었습니다. ${cause instanceof Error ? cause.message : '자동 작성에 실패했습니다.'}` }, { status: 503 });
    }
  }
  catch { return Response.json({ error: "뉴스 수집에 실패했습니다." }, { status: 503 }); }
}
