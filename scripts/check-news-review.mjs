// Run: npx tsx scripts/check-news-review.mjs
// Read-only DB check: npx tsx --env-file=.env.local scripts/check-news-review.mjs --live
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

const source = ts.createSourceFile('route.ts', fs.readFileSync(new URL('../app/api/admin/posts/route.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const filter = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'applyPostFilters');
assert.ok(filter, 'Test the actual shared count/list filter');
const applyFilters = vm.runInNewContext(ts.transpileModule(`(${filter.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);
let requested;
const db = createClient('https://test.supabase.co', 'test-key', { auth: { persistSession: false }, global: { fetch: async input => {
  requested = new URL(typeof input === 'string' ? input : input.url).searchParams;
  return new Response('[]', { headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/0' } });
} } });
const params = { type: 'news', userRole: 'admin', userId: 'owner', adminIds: [], categoryId: 'design', draftOnly: false, publishedOnly: false, reviewOnly: true, query: '100%_완료' };
for (const head of [true, false]) {
  await applyFilters(db.from('posts').select('id', { count: 'exact', head }), params);
  assert.equal(requested.get('is_published'), 'eq.false');
  assert.equal(requested.get('content->paragraphs->0'), 'not.is.null');
  assert.equal(requested.get('content->>category'), 'eq.design');
  assert.equal(requested.get('title'), 'ilike.%100\\%\\_완료%');
}
await applyFilters(db.from('posts').select('id'), { ...params, userRole: 'editor' });
assert.equal(requested.get('author_id'), 'eq.owner');
await applyFilters(db.from('posts').select('id'), { ...params, userRole: 'sub-admin', adminIds: ['admin'] });
assert.equal(requested.get('author_id'), 'not.in.(admin)');
for (const status of ['all', 'draft', 'published']) {
  await applyFilters(db.from('posts').select('id'), { ...params, reviewOnly: false, draftOnly: status === 'draft', publishedOnly: status === 'published' });
  assert.equal(requested.get('content->paragraphs->0'), null);
  assert.equal(requested.get('is_published'), status === 'all' ? null : `eq.${status === 'published'}`);
}
await applyFilters(db.from('posts').select('id'), { ...params, type: 'blog', publishedOnly: true });
assert.equal(requested.get('content->paragraphs->0'), null, 'Review filtering applies only to news');
assert.equal(requested.get('is_published'), 'eq.true');

if (process.argv.includes('--live')) {
  assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, 'overgjynkrnwayfammid.supabase.co');
  const live = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const all = await live.from('posts').select('id,is_published,content').eq('type', 'news');
  const review = await applyFilters(live.from('posts').select('id', { count: 'exact' }), { ...params, categoryId: 'all', query: '' });
  assert.equal(all.error, null); assert.equal(review.error, null);
  assert.ok(all.data.length < 1000, 'Read-only comparison must not be truncated');
  const expected = all.data.filter(row => !row.is_published && Array.isArray(row.content?.paragraphs) && row.content.paragraphs.length > 0);
  assert.deepEqual(review.data.map(row => row.id).sort(), expected.map(row => row.id).sort());
  assert.equal(review.count, expected.length);
  console.log(`Live ARCH.B review queue: ${review.count} articles.`);
}
console.log('News review checks passed: exact count/list filters, category/search, role scope and existing statuses.');
