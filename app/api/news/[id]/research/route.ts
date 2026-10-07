import { checkPostOwnershipOrAdmin } from '@/lib/supabase/post-utils';
import { createAdminClient } from '@/lib/supabase/admin';
import { NEWS_FORMAT } from '@/lib/news-record';
import { researchNews } from '@/lib/news-research';
import { editorialSchema } from '@/lib/news-editorial';
import preparedDrafts from '@/content/news/researched-articles.json';

export const maxDuration = 180;
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permission = await checkPostOwnershipOrAdmin(id);
  if (!permission.authorized) return permission.error;
  const { data: post, error } = await createAdminClient().from('posts').select('content').eq('id', id).eq('type', 'news').single();
  if (error || post?.content?.format !== NEWS_FORMAT) return Response.json({ error: '뉴스를 찾을 수 없습니다.' }, { status: 404 });
  const draft = preparedDrafts.find(draft => draft.article.url === post.content.source_url);
  const article = draft && editorialSchema.safeParse(draft.article);
  return Response.json({ prepared: article?.success ? { article: article.data, research: draft!.research } : null }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permission = await checkPostOwnershipOrAdmin(id);
  if (!permission.authorized) return permission.error;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  try {
    const { data: post, error } = await createAdminClient().from('posts').select('title,content,type').eq('id', id).eq('type', 'news').single();
    if (error || post?.content?.format !== NEWS_FORMAT) return Response.json({ error: '뉴스를 찾을 수 없습니다.' }, { status: 404 });
    const result = await researchNews({ url: post.content.source_url, title: post.content.original_title || post.title, source: post.content.source, category: post.content.category, sourceText: (post.content.source_text || '').slice(0, 6000) }, AbortSignal.any([request.signal, AbortSignal.timeout(180_000)]));
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (cause) { return Response.json({ error: cause instanceof Error && cause.name !== 'TimeoutError' ? cause.message : '조사 시간이 초과되었습니다. 기존 기사는 유지됩니다.' }, { status: 503 }); }
}
