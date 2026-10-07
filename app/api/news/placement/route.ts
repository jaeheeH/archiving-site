import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkPostEditPermission } from '@/lib/supabase/post-utils';
import { NEWS_PLACEMENT_TAG } from '@/lib/news-placement';

const schema = z.object({ featuredId: z.uuid().nullable(), editorPickIds: z.array(z.uuid()).max(3).refine(ids => new Set(ids).size === ids.length, '추천 기사가 중복됩니다.') }).strict();
export async function GET() {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  const db = createAdminClient();
  const [settings, posts] = await Promise.all([
    db.from('site_settings').select('news_featured_post_id,news_editor_pick_ids').single(),
    db.from('posts').select('id,title,type').in('type', ['news', 'blog']).eq('is_published', true).not('published_at', 'is', null).order('published_at', { ascending: false }).limit(300),
  ]);
  if (settings.error || posts.error) return Response.json({ error: '추천 설정을 불러오지 못했습니다.' }, { status: 503 });
  return Response.json({ featuredId: settings.data.news_featured_post_id, editorPickIds: settings.data.news_editor_pick_ids || [], posts: posts.data, writable: ['admin', 'sub-admin'].includes(permission.role) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function PATCH(request: Request) {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  if (!['admin', 'sub-admin'].includes(permission.role)) return Response.json({ error: '관리자·부관리자만 추천을 지정할 수 있습니다.' }, { status: 403 });
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || !request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  const body = await request.text();
  if (body.length > 2000) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
  let parsed;
  try { parsed = schema.safeParse(JSON.parse(body)); } catch { return Response.json({ error: '유효한 JSON이 필요합니다.' }, { status: 400 }); }
  if (!parsed.success) return Response.json({ error: '대표 기사와 추천 기사를 확인해주세요.' }, { status: 400 });
  const { featuredId, editorPickIds } = parsed.data;
  const ids = [...new Set([...(featuredId ? [featuredId] : []), ...editorPickIds])];
  const db = createAdminClient();
  if (ids.length) {
    const result = await db.from('posts').select('id').in('id', ids).in('type', ['news', 'blog']).eq('is_published', true).not('published_at', 'is', null);
    if (result.error || result.data.length !== ids.length) return Response.json({ error: '발행된 기사만 추천에 지정할 수 있습니다.' }, { status: 400 });
  }
  const settings = await db.from('site_settings').select('id').single();
  if (settings.error) return Response.json({ error: '사이트 설정을 찾을 수 없습니다.' }, { status: 503 });
  const saved = await db.from('site_settings').update({ news_featured_post_id: featuredId, news_editor_pick_ids: editorPickIds }).eq('id', settings.data.id);
  if (saved.error) return Response.json({ error: '추천 설정을 저장하지 못했습니다.' }, { status: 503 });
  revalidateTag(NEWS_PLACEMENT_TAG, { expire: 0 }); revalidatePath('/'); revalidatePath('/news/stories');
  return Response.json({ saved: true });
}
