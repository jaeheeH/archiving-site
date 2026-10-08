import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getFreshArtCatalog, ART_CATALOG_TAG } from './art-catalog';
import { checkPostEditPermission } from './supabase/post-utils';
import { createAdminClient } from './supabase/admin';

const text = (max = 300) => z.string().trim().max(max);
const url = z.string().url().max(2000).refine(value => { const parsed = new URL(value); return parsed.protocol === 'https:' && !parsed.username && !parsed.password; }, 'https 주소를 입력해주세요.');
const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const artistSchema = z.object({ name: text(200).min(1), name_ko: text(200).nullable(), source_ids: z.array(text(200).min(1)).max(30) }).strict();
const artworkSchema = z.object({
  title: text().min(1), title_ko: text().min(1), museum: text().min(1), artist: text(),
  artist_ids: z.array(idSchema).max(20), date: text(100), medium: text(500), dimensions: text(500),
  culture: text(), accession: text(), source_url: url, preview_url: url, policy_url: url,
  license: text(200).min(1), themes: z.array(text(50).min(1)).max(20),
  image_width: z.number().int().min(1).max(50000), image_height: z.number().int().min(1).max(50000),
}).strict();
type Resource = 'artworks' | 'artists';

export async function listArt(resource: Resource, request: Request, id?: string) {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  if (id && !idSchema.safeParse(id).success) return Response.json({ error: '잘못된 ID입니다.' }, { status: 400 });
  try {
    const catalog = await getFreshArtCatalog();
    const writable = permission.role === 'admin' || permission.role === 'sub-admin';
    if (id) {
      const record = catalog[resource].find(row => row.id === id);
      return record ? Response.json({ data: record, artists: catalog.artists, writable, databaseReady: catalog.databaseReady }, { headers: { 'Cache-Control': 'private, no-store' } }) : Response.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    }
    const params = new URL(request.url).searchParams;
    const query = (params.get('q') || '').trim().toLocaleLowerCase('ko').slice(0, 100);
    const page = Math.max(1, Math.min(10000, Number.parseInt(params.get('page') || '1', 10) || 1));
    const filtered = catalog[resource].filter(row => JSON.stringify(row).toLocaleLowerCase('ko').includes(query));
    return Response.json({ data: filtered.slice((page - 1) * 20, page * 20), artists: catalog.artists, writable, databaseReady: catalog.databaseReady, pagination: { page, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / 20)) } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: '아카이브를 불러오지 못했습니다.' }, { status: 503 }); }
}

export async function saveArt(resource: Resource, request: Request, id?: string) {
  const permission = await checkPostEditPermission();
  if (!permission.authorized) return permission.error;
  if (!['admin', 'sub-admin'].includes(permission.role)) return Response.json({ error: '관리자와 부관리자만 편집할 수 있습니다.' }, { status: 403 });
  if (id && !idSchema.safeParse(id).success) return Response.json({ error: '잘못된 ID입니다.' }, { status: 400 });
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || !request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  const body = await request.text();
  if (body.length > 30_000) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
  let parsed;
  try { parsed = (resource === 'artists' ? artistSchema : artworkSchema).safeParse(JSON.parse(body)); } catch { return Response.json({ error: '유효한 JSON이 필요합니다.' }, { status: 400 }); }
  if (!parsed.success) return Response.json({ error: '입력 항목을 확인해주세요.', issues: parsed.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })) }, { status: 400 });
  try {
    const db = createAdminClient();
    const recordId = id || randomUUID();
    const existing = id ? await db.from(resource).select(resource === 'artworks' ? 'id,data' : 'id').eq('id', id).maybeSingle() : null;
    if (existing?.error) throw existing.error;
    if (id && !existing?.data) return Response.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    if (resource === 'artists') {
      const values = { ...parsed.data, updated_at: new Date().toISOString() };
      const saved = id ? await db.from('artists').update(values).eq('id', id) : await db.from('artists').insert({ ...values, id: recordId });
      if (saved.error) throw saved.error;
    } else {
      const artwork = artworkSchema.parse(parsed.data);
      const old = existing?.data && 'data' in existing.data ? existing.data.data as Record<string, unknown> : {};
      const saved = await db.rpc('save_artwork', { p_record: { ...old, ...artwork, id: recordId, artist_status: artwork.artist_ids.length ? 'identified' : 'unidentified', collected_at: old.collected_at || new Date().toISOString(), title_ko_status: old.title_ko_status || 'working_translation' }, p_artist_ids: artwork.artist_ids });
      if (saved.error) throw saved.error;
    }
    revalidateTag(ART_CATALOG_TAG, { expire: 0 });
    for (const path of ['/art', '/artists', '/sitemap.xml', '/dashboard', '/dashboard/contents']) revalidatePath(path);
    revalidatePath('/art/[id]', 'page'); revalidatePath('/artists/[id]', 'page');
    return Response.json({ saved: true, id: recordId }, { status: id ? 200 : 201 });
  } catch { return Response.json({ error: '저장하지 못했습니다. 데이터베이스 연결과 작가 연결 항목을 확인해주세요.' }, { status: 503 }); }
}
