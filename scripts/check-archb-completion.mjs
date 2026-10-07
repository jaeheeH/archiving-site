// Live checks use disposable records only, and clean them up in finally.
// Run: npx tsx --env-file=.env.local scripts/check-archb-completion.mjs http://localhost:3000 --live
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { editorialSchema, newsEditSchema } from '../lib/news-editorial.ts';

const fixture = JSON.parse(await fs.readFile(new URL('../content/news/initial-articles.json', import.meta.url), 'utf8')).find(article => article.url.includes('plat-life'));
const article = Object.fromEntries(['url','title','summary','paragraphs','points','tags'].map(key => [key, fixture[key]]));
editorialSchema.parse(article);
assert.equal(editorialSchema.safeParse({ ...article, paragraphs: article.paragraphs.slice(0, 2) }).success, false);
assert.equal(editorialSchema.safeParse({ ...article, paragraphs: article.paragraphs.map(section => ({ ...section, references: section.references.map(ref => ({ ...ref, kind: 'reporting' })) })) }).success, false);
assert.ok(newsEditSchema.safeParse({ article: { ...article, summary: '', paragraphs: [{ heading: '', kind: 'reporting', paragraphs: [''], references: [{ label: '', url: '' }] }] }, is_published: false }).success);
const base = process.argv[2] || 'http://localhost:3000';
assert.equal(new URL(base).hostname, 'localhost', 'Use a local preview for these checks');
const request = async (path, method = 'GET', body, cookie) => {
  const response = await fetch(new URL(path, base), { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { response, data: await response.json() };
};
const news = (await request('/api/news')).data.articles;
assert.ok(news.some(row => row.kind === 'news') && news.some(row => row.kind === 'editorial'));
const published = news.find(row => row.kind === 'news');
for (const path of ['/api/admin/artworks', '/api/admin/artists', '/api/news/placement']) assert.equal((await request(path)).response.status, 401);
assert.equal((await request(`/api/posts/${published.id}/like`, 'PUT', { liked: true })).response.status, 401);
assert.equal((await request(`/api/news/${published.id}/research`, 'POST')).response.status, 401);
console.log('PASS: publication quality and anonymous API boundaries');

if (!process.argv.includes('--live')) process.exit(0);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname, 'overgjynkrnwayfammid.supabase.co', 'Wrong Supabase project');
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const marker = randomUUID();
const password = randomBytes(32).toString('base64url');
const baseline = (await request(`/api/posts/by-slug/${published.slug}`)).data.like_count;
let userId, postId, artworkId, artistId, originalPlacement, cookie;
try {
  const created = await db.auth.admin.createUser({ email: `archb-qa-${marker}@example.com`, password, email_confirm: true, user_metadata: { name: 'ARCH.B 검증', nickname: 'ARCH.B 검증' } });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const role = await db.from('users').update({ role: 'editor' }).eq('id', userId).select('id').single();
  if (role.error) throw role.error;
  let cookies = [];
  const auth = createServerClient(url, anonKey, { cookies: { getAll: () => cookies, setAll: values => { for (const value of values) { cookies = cookies.filter(existing => existing.name !== value.name); cookies.push(value); } } } });
  const signedIn = await auth.auth.signInWithPassword({ email: `archb-qa-${marker}@example.com`, password });
  if (signedIn.error) throw signedIn.error;
  cookie = cookies.map(value => `${value.name}=${value.value}`).join('; ');
  const catalog = await request('/api/admin/artworks', 'GET', undefined, cookie);
  assert.equal(catalog.response.status, 200); assert.equal(catalog.data.writable, false); assert.equal(catalog.data.databaseReady, true);
  assert.equal((await request('/api/admin/artists', 'POST', { name: '검증 작가', name_ko: null, source_ids: [] }, cookie)).response.status, 403);
  assert.equal((await request(`/api/news/${published.id}`, 'PATCH', { article, is_published: false }, cookie)).response.status, 403);
  assert.equal((await request(`/api/news/${published.id}/research`, 'POST', undefined, cookie)).response.status, 403);
  assert.equal((await request('/api/posts', 'POST', { type: 'news', title: '검증 기사' }, cookie)).response.status, 400);
  const inserted = await db.from('posts').insert({ type: 'news', slug: `archb-qa-${marker}`, title: article.title, summary: article.summary, tags: article.tags, author_id: userId, is_published: false, title_image_url: null, content: { format: 'archb-news-v1', source_url: article.url, source: fixture.source, category: fixture.category, original_title: fixture.original_title, source_published_at: fixture.published_at, paragraphs: [], points: [] } }).select('id').single();
  if (inserted.error) throw inserted.error;
  postId = inserted.data.id;
  assert.equal((await request(`/api/posts/${postId}`, 'PUT', { type: 'news', title: article.title }, cookie)).response.status, 400);
  assert.equal((await request(`/api/news/${postId}`, 'PATCH', { article: { ...article, summary: '', paragraphs: [], points: [] }, is_published: false }, cookie)).response.status, 200);
  assert.equal((await request(`/api/posts/${postId}/publish`, 'PATCH', { is_published: true }, cookie)).response.status, 400);
  assert.equal((await request(`/api/news/${postId}`, 'PATCH', { article, is_published: true }, cookie)).response.status, 200);
  const saved = await db.from('posts').select('slug,author_id,is_published,content').eq('id', postId).single();
  assert.equal(saved.data.author_id, userId); assert.equal(saved.data.is_published, true);
  assert.equal((await fetch(new URL(`/news/read/${saved.data.slug}`, base))).status, 200);
  assert.ok((await (await fetch(new URL('/rss.xml', base))).text()).includes(saved.data.slug));
  assert.ok((await (await fetch(new URL('/sitemap.xml', base))).text()).includes(saved.data.slug));
  assert.equal((await request(`/api/news/${postId}`, 'PATCH', { article: { ...article, url: 'https://example.com/changed' }, is_published: false }, cookie)).response.status, 400);
  assert.equal((await request(`/api/posts/${postId}/publish`, 'PATCH', { is_published: false }, cookie)).response.status, 200);
  console.log('PASS: editor ownership, private drafts, quality gates, publish, RSS, sitemap and preserved authors');

  for (let i = 0; i < 2; i++) {
    const liked = await request(`/api/posts/${published.id}/like`, 'PUT', { liked: true }, cookie);
    assert.equal(liked.response.status, 200); assert.equal(liked.data.like_count, baseline + 1); assert.equal(liked.data.liked, true);
  }
  const state = (await request(`/api/posts/by-slug/${published.slug}`, 'GET', undefined, cookie)).data;
  assert.equal(state.userLiked, true); assert.equal(state.like_count, baseline + 1);
  assert.equal((await request(`/api/posts/by-slug/${published.slug}`)).data.userLiked, false);
  assert.equal((await request(`/api/posts/${published.id}/like`, 'PUT', { liked: 'yes' }, cookie)).response.status, 400);
  for (let i = 0; i < 2; i++) assert.equal((await request(`/api/posts/${published.id}/like`, 'PUT', { liked: false }, cookie)).data.like_count, baseline);
  assert.equal((await request(`/api/posts/${postId}/like`, 'PUT', { liked: true }, cookie)).response.status, 404);
  console.log('PASS: account-bound likes, reload state, idempotency, malformed requests and unpublished rejection');

  const promoted = await db.from('users').update({ role: 'sub-admin' }).eq('id', userId); if (promoted.error) throw promoted.error;
  assert.equal((await request(`/api/news/${published.id}/research`, 'POST', undefined, cookie)).response.status, 403, 'Sub-admins cannot process an administrator’s news');
  const person = await request('/api/admin/artists', 'POST', { name: `QA ${marker}`, name_ko: '검증용 작가', source_ids: [] }, cookie);
  assert.equal(person.response.status, 201); artistId = person.data.id;
  const originalWorks = JSON.parse(await fs.readFile(new URL('../research/art-collection/artworks.json', import.meta.url), 'utf8'));
  const artwork = Object.fromEntries(['title','title_ko','museum','artist','artist_ids','date','medium','dimensions','culture','accession','source_url','preview_url','policy_url','license','themes','image_width','image_height'].map(key => [key, originalWorks[0][key]]));
  artwork.artist_ids = [artistId]; artwork.title_ko = '검증용 작품';
  const work = await request('/api/admin/artworks', 'POST', artwork, cookie);
  assert.equal(work.response.status, 201); artworkId = work.data.id;
  assert.equal((await request(`/api/admin/artists/${artistId}`, 'GET', undefined, cookie)).data.data.artwork_ids[0], artworkId);
  assert.equal((await fetch(new URL(`/art/${artworkId}`, base))).status, 200);
  assert.equal((await request(`/api/admin/artworks/${artworkId}`, 'PATCH', { ...artwork, title: 'Should not be saved', artist_ids: ['nonexistent-qa-artist'] }, cookie)).response.status, 503);
  assert.equal((await request(`/api/admin/artworks/${artworkId}`, 'GET', undefined, cookie)).data.data.title, artwork.title);
  assert.equal((await request(`/api/admin/artworks/${artworkId}`, 'PATCH', { ...artwork, title_ko: '수정된 검증 작품' }, cookie)).response.status, 200);
  assert.ok((await (await fetch(new URL(`/art/${artworkId}`, base))).text()).includes('수정된 검증 작품'));
  originalPlacement = (await request('/api/news/placement', 'GET', undefined, cookie)).data;
  const placement = { featuredId: published.id, editorPickIds: news.slice(0, 3).map(row => row.id) };
  assert.equal((await request('/api/news/placement', 'PATCH', placement, cookie)).response.status, 200);
  assert.equal((await request('/api/news/placement', 'GET', undefined, cookie)).data.featuredId, published.id);
  assert.equal((await request('/api/news/placement', 'PATCH', { ...placement, editorPickIds: [published.id, published.id] }, cookie)).response.status, 400);
  assert.equal((await request('/api/news/placement', 'PATCH', { ...placement, featuredId: postId }, cookie)).response.status, 400);
  const demoted = await db.from('users').update({ role: 'editor' }).eq('id', userId); if (demoted.error) throw demoted.error;
  assert.equal((await request(`/api/admin/artworks/${artworkId}`, 'PATCH', artwork, cookie)).response.status, 403);
  assert.equal((await request('/api/news/placement', 'PATCH', placement, cookie)).response.status, 403);
  console.log('PASS: sub-admin catalog edits, atomic links, public invalidation, read-only editors and curated placement');
} finally {
  if (originalPlacement) {
    await db.from('users').update({ role: 'sub-admin' }).eq('id', userId);
    const restored = await request('/api/news/placement', 'PATCH', { featuredId: originalPlacement.featuredId, editorPickIds: originalPlacement.editorPickIds }, cookie);
    assert.equal(restored.response.status, 200, 'Restore curated placement');
  }
  if (userId) {
    const removedLikes = await db.from('post_likes').delete().eq('user_id', userId); if (removedLikes.error) throw removedLikes.error;
  }
  for (const [table, id] of [['posts',postId],['artworks',artworkId],['artists',artistId]]) {
    if (id) { const removed = await db.from(table).delete().eq('id', id); if (removed.error) throw removed.error; }
  }
  if (userId) { const removed = await db.auth.admin.deleteUser(userId); if (removed.error) throw removed.error; }
  console.log('Disposable test records removed; original placement restored.');
}
