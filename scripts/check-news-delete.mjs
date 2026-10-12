// Run: node scripts/check-news-delete.mjs (mocked requests; no live data is deleted).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

const id = '11111111-1111-4111-8111-111111111111';
const owner = '22222222-2222-4222-8222-222222222222';
let post, actor, readFailure, deleteFailure, concurrentChange, deletes, invalidations;
function reset(type = 'news', status = 'ready') {
  post = { id, author_id: owner, slug: 'test-news', type, updated_at: '2026-10-12T00:00:00Z', automation: { status } };
  actor = { id: owner, role: 'admin' };
  readFailure = deleteFailure = concurrentChange = false;
  deletes = 0; invalidations = [];
}
const db = createClient('https://test.supabase.co', 'test-key', {
  auth: { persistSession: false }, global: { fetch: async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.pathname.endsWith('/users')) return Response.json({ role: url.searchParams.get('id') === `eq.${actor.id}` ? actor.role : 'admin' });
    if (options.method === 'DELETE') {
      deletes++;
      if (deleteFailure) return Response.json({ message: '삭제 실패' }, { status: 400 });
      if (concurrentChange) post.updated_at = '2026-10-12T00:01:00Z';
      const matches = post && url.searchParams.get('id') === `eq.${post.id}` && url.searchParams.get('updated_at') === `eq.${post.updated_at}`;
      const data = matches ? [{ id: post.id }] : [];
      if (matches) post = null;
      return Response.json(data);
    }
    const select = url.searchParams.get('select');
    if (select.includes('automation_status:') && readFailure) return Response.json({ message: '조회 실패' }, { status: 503 });
    const data = post && url.searchParams.get('id') === `eq.${post.id}` ? post : null;
    return Response.json(select.includes('automation_status:') ? data ? [{ ...data, automation_status: data.automation?.status || null }] : [] : data);
  } },
});
const mocks = {
  'next/server': { NextResponse: Response },
  'next/cache': { revalidateTag: tag => invalidations.push(tag), revalidatePath: path => invalidations.push(path) },
  '@/lib/public-data': { CACHE_TAGS: { posts: 'public-posts', home: 'public-home' } },
  '@/lib/error-message': { getErrorMessage: (error, fallback) => error?.message || fallback },
  '@/lib/route-params': { isUuidParam: value => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value) },
  '@/lib/supabase/admin': { createAdminClient: () => db },
  './admin': { createAdminClient: () => db },
  './server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: actor } }) } }) },
};
function loadModule(path) {
  const exports = {};
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, console, URL, require: name => { assert.ok(mocks[name], `Unexpected dependency: ${name}`); return mocks[name]; } });
  return exports;
}
mocks['@/lib/supabase/post-utils'] = loadModule('../lib/supabase/post-utils.ts');
const { DELETE } = loadModule('../app/api/posts/[id]/route.ts');
const call = (postId = id, origin) => DELETE(new Request('https://archbehind.com/api/posts/' + postId, { method: 'DELETE', headers: origin ? { Origin: origin } : {} }), { params: Promise.resolve({ id: postId }) });

reset(); actor = null; assert.equal((await call()).status, 401); assert.equal(deletes, 0);
reset(); actor.role = 'user'; assert.equal((await call()).status, 403); assert.equal(deletes, 0);
reset(); actor = { id: 'other-editor', role: 'editor' }; assert.equal((await call()).status, 403); assert.equal(deletes, 0);
reset(); actor = { id: 'sub-admin', role: 'sub-admin' }; assert.equal((await call()).status, 403); assert.equal(deletes, 0);
reset(); assert.equal((await call('invalid')).status, 400); assert.equal(deletes, 0);
reset(); post = null; assert.equal((await call()).status, 404); assert.equal(deletes, 0);
reset(); assert.equal((await call(id, 'https://foreign.example')).status, 403); assert.equal(deletes, 0);
reset('news', 'writing'); assert.equal((await call()).status, 409); assert.equal(deletes, 0); assert.ok(post);
reset(); readFailure = true; assert.equal((await call()).status, 503); assert.equal(deletes, 0); assert.ok(post);
reset(); deleteFailure = true; assert.equal((await call()).status, 400); assert.ok(post); assert.deepEqual(invalidations, []);
reset(); concurrentChange = true; assert.equal((await call()).status, 409); assert.ok(post); assert.deepEqual(invalidations, []);
for (const status of ['ready', 'failed', 'duplicate', undefined]) {
  reset('news', status);
  if (status === undefined) delete post.automation;
  assert.equal((await call(id, 'https://archbehind.com')).status, 200); assert.equal(post, null);
  for (const key of ['public-posts', 'public-home', 'archb-news', '/', '/news/stories', '/rss.xml', '/sitemap.xml', '/news/read/test-news']) assert.ok(invalidations.includes(key), key);
}
reset('blog'); actor.role = 'editor'; assert.equal((await call()).status, 200); assert.ok(invalidations.includes('/blog/test-news'), 'Existing editorial deletion remains available');

// Exercise the real client handler with browser/network stand-ins.
const pageSource = ts.createSourceFile('page.tsx', fs.readFileSync(new URL('../app/(dashboard)/dashboard/contents/news/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const manager = pageSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'NewsManager');
const handler = manager.body.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'deletePost');
let working = '', confirmed = true, requests = 0, reload = 0, notice = '', error = '', responseOK = true, confirmation;
const deletePost = vm.runInNewContext(ts.transpileModule(`(${handler.getText(pageSource)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
  Error, get working() { return working; },
  confirm: message => { confirmation = message; return confirmed; },
  fetch: async (url, options) => { requests++; assert.equal(url, `/api/posts/${id}`); assert.equal(options.method, 'DELETE'); return { ok: responseOK, json: async () => ({ error: '권한이 없습니다.' }) }; },
  setWorking: value => { working = value; }, setNotice: value => { notice = value; }, setError: value => { error = value; }, setReload: update => { reload = update(reload); },
});
const item = { id, title: '테스트 뉴스', is_published: true, content: { automation: { status: 'ready' } } };
confirmed = false; await deletePost(item); assert.equal(requests, 0);
confirmed = true; await deletePost({ ...item, content: { automation: { status: 'writing' } } }); assert.equal(requests, 0);
await deletePost(item); assert.equal(requests, 1); assert.equal(reload, 1); assert.ok(notice); assert.equal(working, ''); assert.match(confirmation, /공개 사이트에서도 삭제/);
responseOK = false; await deletePost(item); assert.equal(reload, 1); assert.equal(error, '권한이 없습니다.'); assert.equal(working, '');
working = `delete:${id}`; await deletePost(item); assert.equal(requests, 2, 'Repeated in-flight clicks are ignored');
console.log('News deletion checks passed: permissions, confirmation, active writing, concurrent edits, failure preservation, cache invalidation and existing editorial deletion. No live data changed.');
