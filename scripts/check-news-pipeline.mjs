import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { assertNewsProject, canAutoWrite, writePendingNews } from '../lib/news-pipeline.ts';
import { NEWS_FORMAT } from '../lib/news-record.ts';

const prepared = JSON.parse(fs.readFileSync(new URL('../content/news/researched-articles.json', import.meta.url), 'utf8'))[0];
const raw = (id, author = 'admin') => ({ id, title: 'Original title', author_id: author, type: 'news', is_published: false, updated_at: '2026-10-07T01:00:00.000Z', content: { format: NEWS_FORMAT, source_url: prepared.article.url, source: 'Dezeen', category: 'design', source_published_at: '2026-10-07T00:00:00Z', source_text: 'Original material' } });
let rows = [], role = 'admin', calls = 0;
const db = createClient('https://test.supabase.co', 'test-key', { auth: { persistSession: false }, global: { fetch: async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const match = (row, key) => !url.searchParams.has(key) || url.searchParams.get(key).startsWith('not.in.') || url.searchParams.get(key) === `eq.${row[key]}`;
  let data;
  if (url.pathname.endsWith('/users')) {
    data = url.searchParams.get('role') === 'eq.admin' ? [{ id: 'admin' }] : [{ role }];
  } else {
    const selected = rows.filter(row => match(row, 'id') && match(row, 'updated_at') && match(row, 'is_published') && match(row, 'author_id') && (!url.searchParams.has('content->paragraphs') || row.content.paragraphs === undefined) && (!url.searchParams.get('author_id')?.startsWith('not.in.') || !url.searchParams.get('author_id').includes(row.author_id)));
    if (options.method === 'PATCH') { const patch = JSON.parse(options.body); for (const row of selected) Object.assign(row, patch); }
    data = selected.map(row => structuredClone(row));
  }
  const headers = new Headers(options.headers);
  if (headers.get('accept')?.includes('application/vnd.pgrst.object')) data = data[0] || null;
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
} } });
const viewer = { userId: 'admin', role: 'admin' };
const writer = async () => { calls++; return structuredClone(prepared); };
assertNewsProject('https://overgjynkrnwayfammid.supabase.co');
assert.throws(() => assertNewsProject('https://xrjqnvsvvnnvfmwnbwsh.supabase.co'));
assert.equal(canAutoWrite({ ...raw('p'), is_published: true }), false);
assert.equal(canAutoWrite({ ...raw('p'), content: { ...raw('p').content, paragraphs: [] } }), false, 'Even incomplete human drafts must be protected');
rows = [raw('p')];
let result = await writePendingNews(db, viewer, { writer });
assert.equal(result.written, 1); assert.equal(rows[0].is_published, false); assert.equal(rows[0].author_id, 'admin');
assert.equal(rows[0].content.automation.status, 'ready'); assert.ok(rows[0].content.research.sources.length >= 2);
result = await writePendingNews(db, viewer, { writer }); assert.equal(result.written, 0); assert.equal(calls, 1);
rows = [raw('p')];
result = await writePendingNews(db, viewer, { writer: async () => { throw new Error('Provider unavailable'); } });
assert.equal(result.failed, 1); assert.equal(rows[0].title, 'Original title'); assert.equal(rows[0].content.source_text, 'Original material'); assert.equal(canAutoWrite(rows[0]), false);
rows[0].content.automation.retry_after = '2020-01-01'; assert.equal(canAutoWrite(rows[0]), true);
rows[0].content.automation.attempts = 3; assert.equal(canAutoWrite(rows[0]), false);
rows = [raw('p')];
result = await writePendingNews(db, viewer, { writer: async () => ({ ...prepared, article: { ...prepared.article, paragraphs: [] } }) });
assert.equal(result.failed, 1); assert.equal(rows[0].content.paragraphs, undefined, 'Invalid output cannot become a draft');
rows = [raw('p')];
result = await writePendingNews(db, viewer, { writer: async () => {
  const concurrent = await writePendingNews(db, viewer, { writer }); assert.equal(concurrent.written, 0);
  rows[0].title = 'Human edit'; rows[0].content.paragraphs = []; rows[0].updated_at = '2026-10-07T02:00:00.000Z';
  return structuredClone(prepared);
} });
assert.equal(result.skipped, 1); assert.equal(rows[0].title, 'Human edit'); assert.deepEqual(rows[0].content.paragraphs, []);
rows = [raw('p')];
result = await writePendingNews(db, viewer, { writer: async () => { rows[0].author_id = 'other'; return structuredClone(prepared); } });
assert.equal(result.skipped, 1); assert.equal(rows[0].title, 'Original title'); assert.equal(rows[0].author_id, 'other');
rows = [raw('p')]; rows[0].content.automation = { status: 'writing', attempts: 1, started_at: '2020-01-01' };
assert.equal((await writePendingNews(db, viewer, { writer })).written, 1, 'Interrupted claims can resume');
rows = [raw('p', 'admin'), raw('q', 'sub')]; role = 'sub-admin';
result = await writePendingNews(db, { userId: 'sub', role }, { writer }); assert.equal(result.written, 1); assert.equal(rows[0].content.paragraphs, undefined);
await assert.rejects(writePendingNews(db, viewer, { writer }), /권한/);
await assert.rejects(writePendingNews(db, { userId: 'sub', role }, { limit: 26, writer }), /1~25/);
const previousGeminiKey = process.env.GEMINI_API_KEY;
delete process.env.GEMINI_API_KEY;
await assert.rejects(writePendingNews(db, viewer), /API 설정/);
if (previousGeminiKey !== undefined) process.env.GEMINI_API_KEY = previousGeminiKey;
console.log('News pipeline checks passed: private drafts, quality, retries, role scope, interrupted claims and concurrent edit preservation.');
