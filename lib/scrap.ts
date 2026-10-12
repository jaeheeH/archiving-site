import 'server-only';
import { revalidateTag } from 'next/cache';
import { createClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';
import { isUuidParam, parsePositiveIntParam } from './route-params';
import { artIdSchema } from './art-input';
import { CACHE_TAGS } from './public-data';
import type { ResourceType } from './resource';

const targets = {
  post: { table: 'posts', scraps: 'post_scraps', foreign: 'post_id' },
  gallery: { table: 'gallery', scraps: 'gallery_scraps', foreign: 'gallery_id' },
  reference: { table: 'references', scraps: 'reference_scraps', foreign: 'reference_id' },
  artwork: { table: 'artworks', scraps: 'artwork_scraps', foreign: 'artwork_id' },
  artist: { table: 'artists', scraps: 'artist_scraps', foreign: 'artist_id' },
} as const;

export async function handleScrap(request: Request, rawId: string, type: ResourceType) {
  const id = type === 'post' ? (isUuidParam(rawId) ? rawId : null) : type === 'artwork' || type === 'artist' ? (artIdSchema.safeParse(rawId).success ? rawId : null) : parsePositiveIntParam(rawId);
  if (!id) return Response.json({ error: '자료 ID를 확인해주세요.' }, { status: 400 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  let desired: boolean | undefined;
  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > 1024) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
    try { const input = JSON.parse(text); if (typeof input?.scraped !== 'boolean') throw new Error(); desired = input.scraped; }
    catch { return Response.json({ error: '저장 여부를 확인해주세요.' }, { status: 400 }); }
  }
  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return Response.json({ error: '로그인이 필요합니다.', requiresAuth: true }, { status: 401 });
    const db = createAdminClient();
    const target = targets[type];
    let query = db.from(target.table).select('id').eq('id', id);
    if (type === 'post') query = query.eq('is_published', true);
    const found = await query.maybeSingle();
    if (found.error) throw found.error;
    if (!found.data) return Response.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 });
    if (desired === undefined) {
      const existing = await db.from(target.scraps).select('id').eq('user_id', user.id).eq(target.foreign, id).maybeSingle();
      if (existing.error) throw existing.error;
      desired = !existing.data;
    }
    const result = desired
      ? await db.from(target.scraps).upsert({ user_id: user.id, [target.foreign]: id }, { onConflict: `user_id,${target.foreign}`, ignoreDuplicates: true })
      : await db.from(target.scraps).delete().eq('user_id', user.id).eq(target.foreign, id);
    if (result.error) throw result.error;
    const counted = await db.from(target.scraps).select('id', { count: 'exact', head: true }).eq(target.foreign, id);
    if (counted.error) throw counted.error;
    const scrapCount = counted.count || 0;
    if (type === 'post') {
      const updated = await db.from('posts').update({ scrap_count: scrapCount }).eq('id', id);
      if (updated.error) throw updated.error;
      revalidateTag(CACHE_TAGS.posts, 'max'); revalidateTag(CACHE_TAGS.home, 'max');
    }
    return Response.json({ success: true, scraped: desired, scrapCount }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (cause) { console.error('Save failed', cause); return Response.json({ error: '저장 처리에 실패했습니다. 다시 시도해주세요.' }, { status: 503 }); }
}
