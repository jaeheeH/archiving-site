import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const base = process.argv.find(arg => arg.startsWith('http'));
assert(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Run against the local production build.');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname, 'overgjynkrnwayfammid.supabase.co');
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const profile = JSON.parse(readFileSync('research/art-collection/editorial.json', 'utf8')).artists[0].profile;
const original = JSON.parse(readFileSync('research/art-collection/artworks.json', 'utf8'))[0];
let account, artistId, artworkId, invalidate;
try {
  const email = `archb-art-qa-${randomUUID()}@example.com`, password = randomUUID() + randomUUID();
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(created.error, null); account = created.data.user.id;
  let cookies = [];
  const auth = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => cookies, setAll: values => { cookies = values; } } });
  assert.equal((await auth.auth.signInWithPassword({ email, password })).error, null);
  const headers = { 'Content-Type': 'application/json', Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '), Origin: new URL(base).origin };
  const request = (path, method = 'GET', body, extra = {}) => fetch(new URL(path, base), { method, headers: { ...headers, ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const role = async value => { assert.equal((await db.from('users').update({ role: value }).eq('id', account)).error, null); };
  const artist = { name: 'ARCH.B editorial QA', name_ko: null, source_ids: [], profile };
  assert.equal((await fetch(new URL('/api/admin/artists', base))).status, 401);
  await role('user'); assert.equal((await request('/api/admin/artists', 'POST', artist)).status, 403);
  await role('admin');
  const result = await request('/api/admin/artists', 'POST', artist);
  assert.equal(result.status, 201); artistId = (await result.json()).id;
  const path = `/api/admin/artists/${artistId}`;
  invalidate = async () => { await role('admin'); assert.equal((await request(path, 'PATCH', artist)).status, 200); };
  assert.equal((await request(path, 'PATCH', { ...artist, profile: { ...profile, sources: [] } })).status, 400);
  assert.equal((await request(path, 'PATCH', { ...artist, profile: { ...profile, related_post_ids: [randomUUID()] } })).status, 400);
  assert.equal((await request(path, 'PATCH', artist, { Origin: 'https://foreign.example' })).status, 403);
  assert.equal((await request(path, 'PATCH', { ...artist, padding: 'x'.repeat(31000) })).status, 413);
  assert.equal((await request(path, 'PATCH', { name: artist.name, name_ko: null, source_ids: [] })).status, 200);
  assert.deepEqual((await db.from('artists').select('profile').eq('id', artistId).single()).data.profile, profile, 'Old clients preserve the introduction.');
  const publicProfile = await (await fetch(new URL(`/artists/${artistId}`, base))).text();
  assert(publicProfile.includes('artist-introduction') && publicProfile.includes(profile.description));
  const work = Object.fromEntries(['title', 'title_ko', 'museum', 'artist', 'date', 'medium', 'dimensions', 'culture', 'accession', 'source_url', 'preview_url', 'policy_url', 'license', 'themes', 'image_width', 'image_height'].map(key => [key, original[key]]));
  work.culture = String(work.culture || ''); work.artist_ids = [artistId]; work.medium_ko = '캔버스에 유채'; work.dimensions_ko = '73.2 × 93.4 cm';
  const added = await request('/api/admin/artworks', 'POST', work);
  assert.equal(added.status, 201); artworkId = (await added.json()).id;
  const saved = await db.from('artworks').select('data').eq('id', artworkId).single();
  assert.equal(saved.error, null); assert.equal(saved.data.data.medium, original.medium); assert.equal(saved.data.data.dimensions, original.dimensions);
  assert.equal((await request(path, 'PATCH', { ...artist, profile: { ...profile, related_post_ids: ['0eb2038f-982f-4192-af39-d653908068a3'] } })).status, 200);
  const related = await (await fetch(new URL(`/artists/${artistId}`, base))).text();
  assert(related.includes('artist-related-articles') && related.includes('《현대 일본 판화가》'));
  await role('sub-admin'); assert.equal((await request(`/api/admin/artworks/${artworkId}`, 'PATCH', { ...work, medium_ko: '유채 · 검증' })).status, 200);
  const publicWork = await (await fetch(new URL(`/art/${artworkId}`, base))).text();
  assert(publicWork.includes('유채 · 검증') && publicWork.includes('재료·크기 원문 보기') && publicWork.includes(original.medium));
  await role('editor'); assert.equal((await request(path)).status, 200); assert.equal((await request(path, 'PATCH', artist)).status, 403);
  const editor = await (await request(`/dashboard/contents/artists/${artistId}/edit`)).text();
  assert(editor.includes('조회 모드입니다.') && editor.includes('profile.description') && editor.includes('disabled=""'));
  await role('admin');
  const admin = await (await request(`/dashboard/contents/artists/${artistId}/edit`)).text();
  assert(admin.includes('profile.description') && admin.includes('profile.sources.0.url') && admin.includes('profile.related_post_ids'));
  assert.equal((await request(path, 'PATCH', { ...artist, profile: { ...profile, description: '', sources: [], related_post_ids: [] } })).status, 200);
  assert(!(await (await fetch(new URL(`/artists/${artistId}`, base))).text()).includes('artist-introduction'), 'Public cache invalidates immediately after editing.');
  console.log('Live art API checks passed: permissions, sourced introductions, related published posts, original preservation, editor fields and cache invalidation.');
} finally {
  // Expire public caches before direct cleanup, without another read of the fixtures.
  try { if (invalidate) await invalidate(); }
  finally {
    if (artworkId) assert.equal((await db.from('artworks').delete().eq('id', artworkId)).error, null);
    if (artistId) assert.equal((await db.from('artists').delete().eq('id', artistId)).error, null);
    if (account) assert.equal((await db.auth.admin.deleteUser(account)).error, null);
  }
}
