import { checkPostEditPermission } from "@/lib/supabase/post-utils";
import { collectNews } from "@/lib/news";
export async function POST(request: Request) {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  try { return Response.json(await collectNews(permission.userId)); }
  catch { return Response.json({ error: "뉴스 수집에 실패했습니다." }, { status: 503 }); }
}
