import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUuidParam } from '@/lib/route-params';
import { CACHE_TAGS } from '@/lib/public-data';

const likeRequest = z.object({ liked: z.boolean() }).strict();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuidParam(id)) return Response.json({ error: '잘못된 기사 ID입니다.' }, { status: 400 });
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || !request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const body = await request.text();
  if (body.length > 1000) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
  let parsed;
  try { parsed = likeRequest.safeParse(JSON.parse(body)); } catch { return Response.json({ error: '유효한 JSON이 필요합니다.' }, { status: 400 }); }
  if (!parsed.success) return Response.json({ error: 'liked 값은 boolean이어야 합니다.' }, { status: 400 });
  const { data, error } = await createAdminClient().rpc('set_post_like', { p_post_id: id, p_user_id: user.id, p_liked: parsed.data.liked });
  if (error) return Response.json({ error: error.code === 'P0002' ? '기사를 찾을 수 없습니다.' : '좋아요를 저장하지 못했습니다.' }, { status: error.code === 'P0002' ? 404 : 503 });
  revalidateTag(CACHE_TAGS.posts, { expire: 0 });
  return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}
