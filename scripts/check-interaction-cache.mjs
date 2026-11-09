// Mocked requests only: node scripts/check-interaction-cache.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as zod from 'zod';
import { createClient } from '@supabase/supabase-js';

const id = '11111111-1111-4111-8111-111111111111';
let signedIn, failed, scraped, invalidations, mutations;
function reset() { signedIn = true; failed = scraped = false; invalidations = []; mutations = []; }
const db = createClient('https://test.supabase.co', 'test-key', { auth: { persistSession: false }, global: { fetch: async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = options.method || 'GET';
  if (['POST', 'PATCH', 'DELETE'].includes(method)) {
    mutations.push({ method, path: url.pathname });
    if (failed) return Response.json({ message: 'Temporary failure' }, { status: 503 });
    if (url.pathname.endsWith('/rpc/set_post_like')) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_post_id, id);
      return Response.json({ liked: body.p_liked, like_count: body.p_liked ? 3 : 2 });
    }
    if (method === 'POST') scraped = true;
    if (method === 'DELETE') scraped = false;
    if (method === 'PATCH') assert.equal(JSON.parse(options.body).scrap_count, scraped ? 3 : 2);
    return Response.json(null);
  }
  if (method === 'HEAD') return new Response(null, { headers: { 'content-range': `0-0/${scraped ? 3 : 2}` } });
  return Response.json(url.pathname.endsWith('_scraps') ? (scraped ? [{ id: 'saved' }] : []) : [{ id }]);
} } });
const cacheDefinitions = new Map();
const mocks = {
  'server-only': {}, zod,
  'next/cache': {
    unstable_cache: (fn, keys, options) => { cacheDefinitions.set(fn, options); return fn; },
    revalidateTag: (tag, profile) => invalidations.push({ tag, profile }),
  },
  './gallery-search-data': {}, './search-text': {}, './news-feeds': {}, './banners': {}, './related-posts': {}, '@/lib/avatar-url': {},
  '@/lib/supabase/public': { createPublicClient: () => db },
  './art-input': { artIdSchema: zod.z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/) },
};
function load(path) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, URL, Response, console: { error() {} }, require: name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`);
    return mocks[name];
  } });
  return exports;
}
const publicData = load('../lib/public-data.ts');
const { CACHE_TAGS } = publicData;
mocks['@/lib/public-data'] = mocks['./public-data'] = publicData;
mocks['@/lib/route-params'] = mocks['./route-params'] = load('../lib/route-params.ts');
mocks['@/lib/supabase/admin'] = mocks['./supabase/admin'] = { createAdminClient: () => db };
mocks['@/lib/supabase/server'] = mocks['./supabase/server'] = { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'reader' } : null } }) } }) };
const { PUT } = load('../app/api/posts/[id]/like/route.ts');
const { handleScrap } = load('../lib/scrap.ts');
for (const fn of [publicData.getHomeData, publicData.getPostsPageData]) {
  assert.ok(cacheDefinitions.get(fn).tags.includes(CACHE_TAGS.postCounts));
  assert.ok(cacheDefinitions.get(fn).tags.includes(CACHE_TAGS.posts), 'Content edits still invalidate lists');
}
assert.equal([...cacheDefinitions.values()].filter(options => options.tags.includes(CACHE_TAGS.postCounts)).length, 2, 'Counter changes only invalidate the two count-bearing data readers');
assert.ok(!cacheDefinitions.get(publicData.getBlogPostData).tags.includes(CACHE_TAGS.postCounts), 'Article HTML keeps its cache; live bookmark counts use the existing private status API');

const request = (body, origin = 'https://archbehind.com') => new Request(`https://archbehind.com/api/posts/${id}/like`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
});
const like = (body = { liked: true }, origin) => PUT(request(body, origin), { params: Promise.resolve({ id }) });
const save = (type = 'post', rawId = id, body = { scraped: true }, origin) => handleScrap(request(body, origin), rawId, type);
function onlyCounts(profile) {
  assert.equal(invalidations.length, 1);
  assert.equal(invalidations[0].tag, CACHE_TAGS.postCounts);
  assert.equal(typeof invalidations[0].profile === 'string' ? invalidations[0].profile : invalidations[0].profile.expire, profile);
}
reset(); let response = await like(); assert.equal(response.status, 200); assert.equal((await response.json()).like_count, 3); onlyCounts(0);
reset(); response = await like({ liked: false }); assert.equal((await response.json()).like_count, 2); onlyCounts(0);
reset(); signedIn = false; assert.equal((await like()).status, 401); assert.equal(mutations.length, 0); assert.equal(invalidations.length, 0);
reset(); assert.equal((await like({ liked: 'yes' })).status, 400); assert.equal(mutations.length, 0);
reset(); assert.equal((await like({ liked: true }, 'https://foreign.example')).status, 403); assert.equal(mutations.length, 0);
reset(); failed = true; assert.equal((await like()).status, 503); assert.equal(invalidations.length, 0);

reset(); response = await save(); assert.equal(response.status, 200); assert.equal((await response.json()).scrapCount, 3); onlyCounts('max');
reset(); scraped = true; response = await save('post', id, { scraped: false }); assert.equal((await response.json()).scrapCount, 2); onlyCounts('max');
reset(); signedIn = false; assert.equal((await save()).status, 401); assert.equal(mutations.length, 0);
reset(); assert.equal((await save('post', id, { scraped: true }, 'https://foreign.example')).status, 403); assert.equal(mutations.length, 0);
reset(); failed = true; assert.equal((await save()).status, 503); assert.equal(invalidations.length, 0);
for (const [type, rawId] of [['gallery', '1'], ['reference', '1'], ['artwork', 'work-1'], ['artist', 'artist-1']]) {
  reset(); assert.equal((await save(type, rawId)).status, 200); assert.equal(invalidations.length, 0, type);
}
console.log('Interaction cache checks passed: counter-only invalidation, preserved counts, content edit tags, authentication, origin checks, validation, failures and all five bookmark types. No live data changed.');
