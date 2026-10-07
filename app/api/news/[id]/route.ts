import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPostOwnershipOrAdmin } from "@/lib/supabase/post-utils";
import { newsEditSchema } from "@/lib/news-editorial";
import { NEWS_FORMAT } from "@/lib/news-record";
import { CACHE_TAGS } from "@/lib/public-data";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permission = await checkPostOwnershipOrAdmin(id);
  if (!permission.authorized) return permission.error;
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || !request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const body = await request.text();
  if (body.length > 100_000) return Response.json({ error: "요청이 너무 큽니다." }, { status: 413 });
  let parsed;
  try { parsed = newsEditSchema.safeParse(JSON.parse(body)); } catch { return Response.json({ error: "유효한 JSON이 필요합니다." }, { status: 400 }); }
  if (!parsed.success) return Response.json({ error: "제목·요약·본문·참고자료를 확인해주세요.", issues: parsed.error.issues.map(issue => ({ field: issue.path.join("."), message: issue.message })) }, { status: 400 });
  try {
    const db = createAdminClient();
    const { data: post, error } = await db.from("posts").select("slug,content,published_at").eq("id", id).eq("type", "news").single();
    if (error || post?.content?.format !== NEWS_FORMAT) return Response.json({ error: "뉴스를 찾을 수 없습니다." }, { status: 404 });
    const { article, is_published } = parsed.data;
    if (article.url !== post.content.source_url) return Response.json({ error: "원출처는 변경할 수 없습니다." }, { status: 400 });
    const saved = await db.from("posts").update({
      title: article.title, summary: article.summary, tags: article.tags, is_published,
      published_at: is_published ? post.published_at || post.content.source_published_at || new Date().toISOString() : null,
      content: { ...post.content, paragraphs: article.paragraphs, points: article.points, automation: post.content.automation?.status === 'writing' ? undefined : post.content.automation },
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("type", "news");
    if (saved.error) throw saved.error;
    revalidateTag("archb-news", { expire: 0 });
    revalidatePath("/rss.xml"); revalidatePath("/sitemap.xml");
    revalidateTag(CACHE_TAGS.posts, { expire: 0 });
    revalidateTag(CACHE_TAGS.home, { expire: 0 });
    revalidatePath("/"); revalidatePath("/news/stories"); revalidatePath(`/news/read/${post.slug}`);
    return Response.json({ saved: true, is_published }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "뉴스를 저장하지 못했습니다." }, { status: 503 }); }
}
