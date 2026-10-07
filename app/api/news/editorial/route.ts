import { checkPostEditPermission } from "@/lib/supabase/post-utils";
import { pendingNews, saveNewsEditorials } from "@/lib/news";
import { editorialBatchSchema } from "@/lib/news-editorial";
export async function GET() {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  try { return Response.json(await pendingNews(permission), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "가공 대기 뉴스를 불러오지 못했습니다." }, { status: 503 }); }
}
export async function POST(request: Request) {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || !request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const body = await request.text();
  if (body.length > 100_000) return Response.json({ error: "요청이 너무 큽니다." }, { status: 413 });
  let parsed;
  try { parsed = editorialBatchSchema.safeParse(JSON.parse(body)); } catch { return Response.json({ error: "유효한 JSON이 필요합니다." }, { status: 400 }); }
  if (!parsed.success) return Response.json({ error: "한국어 기사 본문과 출처를 확인해주세요." }, { status: 400 });
  try { return Response.json(await saveNewsEditorials(parsed.data.articles, permission)); }
  catch { return Response.json({ error: "가공 기사를 저장하지 못했습니다." }, { status: 503 }); }
}
