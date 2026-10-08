import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createNewsJob, getNewsJob, runNextNewsJob, authorizeNewsWorker } from '../lib/news-jobs.ts';
import { NEWS_FORMAT } from '../lib/news-record.ts';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://overgjynkrnwayfammid.supabase.co';
const prepared = JSON.parse(fs.readFileSync(new URL('../content/news/researched-articles.json', import.meta.url), 'utf8'))[0];
const raw = id => ({ id, type: 'news', title: 'Original title', author_id: 'admin', is_published: false, updated_at: '2026-10-07T01:00:00Z',
  content: { format: NEWS_FORMAT, source_url: prepared.article.url, source: 'Dezeen', category: 'design' } });
const viewer = { userId: 'admin', role: 'admin' };
const active = row => ['queued','collecting','writing'].includes(row.status);
let posts = [], jobs = [], calls = 0, role = 'admin', failCheckpoint = false;
const writer = async () => { calls++; return structuredClone(prepared); };
const token = 'a'.repeat(64);
const matches = (row, params) => [...params].every(([key, value]) => {
  if (['select','order','limit','offset'].includes(key)) return true;
  if (key === 'content->paragraphs') return row.content?.paragraphs === undefined;
  if (key === 'content->>collection_job_id') return row.content?.collection_job_id === value.slice(3);
  if (key === 'content->automation->>started_at') return !!row.content?.automation?.started_at;
  if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
  if (value.startsWith('in.')) return value.slice(4,-1).split(',').includes(String(row[key]));
  if (value.startsWith('not.in.')) return !value.slice(8,-1).split(',').includes(String(row[key]));
  return true;
});
const client = () => createClient('https://test.supabase.co', 'test-key', { auth: { persistSession: false }, global: { fetch: async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const body = options.body ? JSON.parse(options.body) : {};
  let data = [], status = 200;
  if (url.pathname.endsWith('/claim_news_job')) {
    const row = jobs.find(job => active(job) && (!body.p_job_id || job.id === body.p_job_id) && (!job.lease_until || Date.parse(job.lease_until) < Date.now()));
    if (row) { Object.assign(row, { lease_token: randomUUID(), lease_until: new Date(Date.now()+600000).toISOString() }); data = [structuredClone(row)]; }
  } else if (url.pathname.endsWith('/users')) data = url.searchParams.get('role') === 'eq.admin' ? [{ id:'admin' }] : [{ role }];
  else if (url.pathname.endsWith('/news_worker_config')) data = [{ token_sha256: createHash('sha256').update(token).digest('hex') }];
  else {
    const table = url.pathname.endsWith('/news_jobs') ? jobs : posts;
    const selected = table.filter(row => matches(row,url.searchParams));
    if (options.method === 'POST' && table === posts) {
      data = body.filter(post => !posts.some(existing => existing.slug === post.slug)).map(post => ({ ...post, id: randomUUID(), updated_at: new Date().toISOString() }));
      posts.push(...structuredClone(data));
    } else if (options.method === 'POST') {
      if (jobs.some(job => job.author_id === body.author_id && active(job))) { status = 409; data = { code:'23505', message:'Duplicate batch' }; }
      else { const row = { ...body, id:randomUUID(), status:'queued', created_at: new Date(Date.now()+jobs.length).toISOString() }; jobs.push(row); data = [structuredClone(row)]; }
    } else {
      if (options.method === 'PATCH') {
        if (table === jobs && failCheckpoint && body.lease_token === null) { failCheckpoint = false; status=503; data={ message:'Simulated checkpoint outage' }; }
        else for (const row of selected) Object.assign(row, structuredClone(body));
      }
      if (status === 200) {
        data = selected.map(row => url.searchParams.get('select') === 'source:content->>source,updated_at' ? {source:row.content.source,updated_at:row.updated_at} : structuredClone(row));
        if (table === jobs) data.reverse();
        if (url.searchParams.has('limit')) data = data.slice(0,Number(url.searchParams.get('limit')));
      }
    }
  }
  if (status === 200 && new Headers(options.headers).get('accept')?.includes('application/vnd.pgrst.object')) data = data[0] || null;
  const count = Array.isArray(data) ? data.length : 0;
  return new Response(options.method === 'HEAD' ? null : JSON.stringify(data),{status,headers:{'Content-Type':'application/json', 'Content-Range': `0-${Math.max(0,count-1)}/${count}`}});
} } });
let db = client();
posts = [raw('one'),raw('two')];
const submitted = await Promise.all([createNewsJob(db,viewer,{limit:2,writer}),createNewsJob(db,viewer,{limit:2,writer})]);
assert.equal(jobs.length,1); assert.equal(submitted[0].job.id,submitted[1].job.id);
let job = submitted[0].job;
await runNextNewsJob(db,{jobId:job.id,writer});
assert.equal(calls,0,'Planning is separate from article writing');
assert.equal((await getNewsJob(client(),viewer.userId)).queued,2,'A new process reads the persisted queue');
let release;
const gate = new Promise(resolve => { release=resolve; });
const running = runNextNewsJob(db,{jobId:job.id,writer:async()=>{await gate;return writer();}});
await new Promise(resolve=>setTimeout(resolve,10));
const browser = new AbortController(); browser.abort();
assert.equal(await runNextNewsJob(client(),{jobId:job.id,writer}),null,'Concurrent worker cannot take a live lease');
release(); await running;
job = await getNewsJob(client(),viewer.userId);
assert.equal(job.written,1); assert.equal(job.queued,1); assert.equal(calls,1,'One invocation writes one article');
assert.equal(await getNewsJob(db,'different-user'),null,'Account cannot see another private job');
db = client(); await runNextNewsJob(db,{jobId:job.id,writer});
job = await getNewsJob(db,viewer.userId);
assert.equal(job.status,'completed'); assert.equal(job.written,2);
assert.ok(posts.every(post=>post.content.automation.status==='ready' && !post.is_published));
assert.equal(await runNextNewsJob(db,{jobId:job.id,writer}),null,'Completed batch cannot run twice');

// Collection commits are idempotent and their count survives a checkpoint outage.
jobs=[]; posts=[]; calls=0;
const networkFetch=globalThis.fetch;
globalThis.fetch=async()=>new Response(`<rss><channel><item><title>Collected story</title><link>${prepared.article.url}</link><pubDate>${new Date().toUTCString()}</pubDate><description>Original source</description></item></channel></rss>`);
try {
  job=(await createNewsJob(db,viewer,{limit:1,withCollection:true,writer})).job;
  failCheckpoint=true;
  await assert.rejects(runNextNewsJob(db,{jobId:job.id,writer}),/진행 상태/);
  assert.equal(posts.length,1); assert.equal(jobs[0].state.collectionDone,false);
  jobs[0].lease_until='2020-01-01';
  await runNextNewsJob(client(),{jobId:job.id,writer});
  job=await getNewsJob(db,viewer.userId);
  assert.equal(posts.length,1); assert.equal(job.collected,1); assert.equal(calls,0);
  assert.equal(job.status,'queued','Collection completes separately from planning and writing');
} finally { globalThis.fetch=networkFetch; }

// Article committed, checkpoint did not: an expired lease recovers without another AI call.
jobs=[]; posts=[raw('checkpoint')]; calls=0;
job=(await createNewsJob(db,viewer,{limit:1,writer})).job;
await runNextNewsJob(db,{jobId:job.id,writer}); failCheckpoint=true;
await assert.rejects(runNextNewsJob(db,{jobId:job.id,writer}),/진행 상태/);
assert.equal(posts[0].content.automation.status,'ready'); assert.equal(jobs[0].state.cursor,0);
jobs[0].lease_until='2020-01-01';
await runNextNewsJob(client(),{jobId:job.id,writer});
assert.equal(calls,1); assert.equal((await getNewsJob(db,viewer.userId)).written,1);

jobs=[]; posts=[raw('fatal'),raw('untouched')]; calls=0;
job=(await createNewsJob(db,viewer,{limit:2,writer})).job;
await runNextNewsJob(db,{jobId:job.id,writer});
await runNextNewsJob(db,{jobId:job.id,writer:async()=>{calls++;throw Error('Gemini 조사 요청에 실패했습니다 (403)');}});
job=await getNewsJob(db,viewer.userId);
assert.equal(job.status,'failed'); assert.equal(job.failed,1); assert.equal(calls,1);
assert.equal(posts[1].content.automation,undefined,'Provider auth failure stops the rest');
assert.ok(posts.every(post=>!post.is_published));
await assert.rejects(createNewsJob(db,viewer,{limit:16,writer}),/1~15/);
assert.equal(await authorizeNewsWorker(db,null),false);
assert.equal(await authorizeNewsWorker(db,`Bearer ${'b'.repeat(64)}`),false);
assert.equal(await authorizeNewsWorker(db,`Bearer ${token}`),true);
role='user'; jobs=[];
await assert.rejects(createNewsJob(db,viewer,{writer}),/권한/);
for (const route of ['collect','process','worker']) {
  const source=fs.readFileSync(new URL(`../app/api/news/${route}/route.ts`,import.meta.url),'utf8');
  assert.equal(Number(source.match(/export const maxDuration = (\d+)/)[1]),300,'Hobby-compatible execution limit');
}
console.log('Durable news job checks passed: duplicate submissions, one-article steps, browser abort, process-independent progress, leases, checkpoint recovery, provider errors, private accounts and worker authentication.');
