import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { assertNewsProject, canAutoWrite, canRetryNews, writePendingNews, newsWritingQueue } from '../lib/news-pipeline.ts';
import { DuplicateNewsError } from '../lib/news-duplicates.ts';
import { NEWS_FORMAT } from '../lib/news-record.ts';
import { researchNews } from '../lib/news-research.ts';

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
    const selected = rows.filter(row => match(row, 'id') && match(row, 'updated_at') && match(row, 'is_published') && match(row, 'author_id') && (!url.searchParams.has('content->paragraphs') || (url.searchParams.get('content->paragraphs') === 'not.is.null' ? row.content.paragraphs !== undefined : row.content.paragraphs === undefined)) && (!url.searchParams.has('content->automation->>started_at') || row.content.automation?.started_at) && (!url.searchParams.get('author_id')?.startsWith('not.in.') || !url.searchParams.get('author_id').includes(row.author_id)) && (!url.searchParams.has('or') || row.is_published || url.searchParams.get('or').includes(`author_id.eq.${row.author_id})`)));
    if (options.method === 'PATCH') { const patch = JSON.parse(options.body); for (const row of selected) Object.assign(row, patch); }
    data = selected.map(row => url.searchParams.get('select') === 'source:content->>source,updated_at' ? { source: row.content.source, updated_at: row.updated_at } : url.searchParams.get('select').includes('original_title:') ? { id: row.id, slug: row.slug, title: row.title, summary: row.summary, is_published: row.is_published, ...Object.fromEntries(['source','source_url','source_published_at','original_title'].map(key => [key,row.content[key]])) } : structuredClone(row));
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
assert.equal(canRetryNews(rows[0]), true);
assert.equal(canRetryNews({ ...rows[0], is_published: true }), false);
assert.equal(canRetryNews({ ...rows[0], content: { ...rows[0].content, paragraphs: [] } }), false);
assert.equal(canRetryNews({ ...rows[0], content: { ...rows[0].content, automation: { status:'writing',attempts:4,started_at:new Date().toISOString(),job_id:'retry-job' } } },'retry-job'), false,'A live article claim remains protected');
await assert.rejects(writePendingNews(db, viewer, { writer, manualRetry:true }), /한 편/);
await assert.rejects(writePendingNews(db, viewer, { writer, manualRetry:true,postId:'p',limit:2 }), /한 편/);
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

const duplicateMatch = { id: 'existing', slug: 'existing-slug', title: '기존 기사', source: '매체', is_published: true, reason: '같은 발표의 번역본' };
rows = [raw('duplicate')];
result = await writePendingNews(db, viewer, { writer: async () => { throw new DuplicateNewsError([duplicateMatch]); } });
assert.equal(result.duplicates, 1); assert.equal(result.failed, 0); assert.equal(result.written, 0);
assert.equal(rows[0].title, 'Original title'); assert.equal(rows[0].content.source_text, 'Original material'); assert.equal(rows[0].is_published, false);
assert.equal(rows[0].content.duplicate_review.status, 'pending'); assert.equal(rows[0].content.automation.error, undefined);
assert.equal(canAutoWrite(rows[0]), false); assert.equal(canRetryNews(rows[0]), false);
assert.equal((await newsWritingQueue(db, viewer)).duplicates, 1);
assert.equal((await writePendingNews(db, viewer, { writer })).written, 0, 'Duplicate holds cannot be retried automatically');
rows[0].content.duplicate_review.status = 'allowed'; rows[0].content.automation = undefined;
result = await writePendingNews(db, viewer, { writer: async input => { assert.deepEqual(input.duplicateCandidates, []); return structuredClone(prepared); } });
assert.equal(result.written, 1); assert.equal(rows[0].content.duplicate_review, undefined, 'Private comparison metadata must not enter a finished article');

rows = [raw('incoming'), { ...raw('my-draft'), content: { ...raw('p').content, paragraphs: [] } }, { ...raw('private', 'another'), content: { ...raw('p').content, paragraphs: [] } }, { ...raw('public', 'another'), is_published: true, content: { ...raw('p').content, paragraphs: [] } }];
await writePendingNews(db, viewer, { postId: 'incoming', writer: async input => {
  const ids = input.duplicateCandidates.map(candidate => candidate.id);
  assert.ok(ids.includes('my-draft') && ids.includes('public'));
  assert.ok(!ids.includes('private') && !ids.includes('incoming'), 'Another account’s private draft and self are not comparison targets');
  return structuredClone(prepared);
} });
rows = [raw('p', 'admin'), raw('q', 'sub')]; role = 'sub-admin';
result = await writePendingNews(db, { userId: 'sub', role }, { writer }); assert.equal(result.written, 1); assert.equal(rows[0].content.paragraphs, undefined);
await assert.rejects(writePendingNews(db, viewer, { writer }), /권한/);
await assert.rejects(writePendingNews(db, { userId: 'sub', role }, { limit: 26, writer }), /1~25/);
const previousGeminiKey = process.env.GEMINI_API_KEY;
delete process.env.GEMINI_API_KEY;
await assert.rejects(writePendingNews(db, viewer), /API 설정/);
if (previousGeminiKey !== undefined) process.env.GEMINI_API_KEY = previousGeminiKey;

// A daily batch can be smaller than the source catalog without starving the other publishers.
role = 'admin';
rows = Array.from({ length: 23 }, (_, i) => ({ ...raw(`source-${i}`), content: { ...raw('p').content, source: `Publisher ${i}` } }));
result = await writePendingNews(db, viewer, { limit: 15, writer });
assert.equal(result.written, 15);
rows.unshift(...Array.from({ length: 15 }, (_, i) => ({ ...raw(`new-source-${i}`), content: { ...raw('p').content, source: `Publisher ${i}`, source_published_at: '2026-10-07T03:00:00Z' } })));
result = await writePendingNews(db, viewer, { limit: 8, writer });
assert.ok(result.items.every(item => /^source-(?:1[5-9]|2[0-2])$/.test(item.id)), 'Previously unprocessed sources must be selected before another fresh item from recently processed sources');

// An unresolved Google citation redirect cannot masquerade as a second verified source.
const originalFetch = globalThis.fetch;
process.env.GEMINI_API_KEY = 'test-key';
globalThis.fetch = async input => String(input).includes('vertexaisearch.cloud.google.com') ? new Response(null, { status: 404 }) : Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '확인 가능한 조사 메모' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/unresolved', title: 'Unresolved source' } }], groundingSupports: [{ segment: { text: 'Claim' }, groundingChunkIndices: [0] }] } }] });
try { await assert.rejects(researchNews({ url: prepared.article.url, title: '자료 확인', source: 'Test', category: 'ai' }), /근거 자료가 부족/); }
finally { globalThis.fetch = originalFetch; if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousGeminiKey; }

const referenceUrls = [...new Set([prepared.article.url, ...prepared.article.paragraphs.flatMap(section => section.references.map(reference => reference.url))])];
const generated = { ...prepared.article, primary_source_ids: referenceUrls.map((_, index) => `s${index}`), paragraphs: prepared.article.paragraphs.map(section => ({ ...section, references: section.references.map(reference => ({ label: reference.label, source_id: `s${referenceUrls.indexOf(reference.url)}` })) })) };
let approve = false, drafts = 0, reviews = 0;
process.env.GEMINI_API_KEY = 'test-key';
globalThis.fetch = async (input, options) => {
  const request = JSON.parse(options.body);
  const system = request.systemInstruction.parts[0].text;
  const investigation = system.includes('자료 조사 담당자');
  const reviewing = system.includes('사실 검수 담당자');
  if (reviewing) reviews++; else if (!investigation) drafts++;
  return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: investigation ? '공식 자료로 확인한 조사 메모' : JSON.stringify(reviewing ? { approved: approve, issues: approve ? [] : ['조사 메모에 없는 성능 단정을 삭제해주세요.'] } : generated) }] }, ...(investigation ? { groundingMetadata: { groundingChunks: referenceUrls.slice(1).map(uri => ({ web: { uri, title: 'Official source' } })), groundingSupports: [{ segment: { text: 'Claim' }, groundingChunkIndices: [0] }] } } : {}) }] });
};
try {
  const input = { url: prepared.article.url, title: '자료 확인', source: 'Test', category: 'design' };
  await assert.rejects(researchNews(input), /사실 검수.*성능 단정/);
  assert.equal(drafts, 2); assert.equal(reviews, 2, 'Unverified claims get one bounded repair, never an accepted draft');
  approve = true;
  const checked = await researchNews(input);
  assert.equal(checked.research.qualityReview.passed, true);
} finally { globalThis.fetch = originalFetch; if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousGeminiKey; }

console.log('News pipeline checks passed: private drafts, quality, retries, roles, source fairness, and edit preservation.');
