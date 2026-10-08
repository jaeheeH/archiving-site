import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createNewsJob, getNewsJob, runNextNewsJob, authorizeNewsWorker } from '../lib/news-jobs.ts';
import { NEWS_FORMAT } from '../lib/news-record.ts';
import { DuplicateNewsError } from '../lib/news-duplicates.ts';

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
  if (key === 'content->paragraphs') return value === 'not.is.null' ? row.content?.paragraphs !== undefined : row.content?.paragraphs === undefined;
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

// A duplicate hold also survives a lost checkpoint without another model request.
jobs=[]; posts=[raw('duplicate-checkpoint')]; calls=0;
job=(await createNewsJob(db,viewer,{limit:1,writer})).job;
await runNextNewsJob(db,{jobId:job.id,writer}); failCheckpoint=true;
await assert.rejects(runNextNewsJob(db,{jobId:job.id,writer:async()=>{calls++;throw new DuplicateNewsError([{id:'existing',slug:'existing-slug',title:'기존 기사',source:'매체',is_published:true,reason:'같은 소식'}]);}}),/진행 상태/);
assert.equal(posts[0].content.automation.status,'duplicate'); assert.equal(posts[0].content.paragraphs,undefined);
jobs[0].lease_until='2020-01-01';
await runNextNewsJob(client(),{jobId:job.id,writer});
job=await getNewsJob(db,viewer.userId);
assert.equal(calls,1); assert.equal(job.duplicates,1); assert.equal(job.failed,0); assert.equal(job.status,'completed');

jobs=[]; posts=[raw('fatal'),raw('untouched')]; calls=0;
job=(await createNewsJob(db,viewer,{limit:2,writer})).job;
await runNextNewsJob(db,{jobId:job.id,writer});
await runNextNewsJob(db,{jobId:job.id,writer:async()=>{calls++;throw Error('Gemini 조사 요청에 실패했습니다 (403)');}});
job=await getNewsJob(db,viewer.userId);
assert.equal(job.status,'failed'); assert.equal(job.failed,1); assert.equal(calls,1);
assert.equal(posts[1].content.automation,undefined,'Provider auth failure stops the rest');
assert.ok(posts.every(post=>!post.is_published));

// Manual retry targets one failed article, even after the automatic cap/cooldown.
jobs=[]; posts=[raw('retry'),raw('untouched')]; calls=0;
posts[0].content.automation={status:'failed',attempts:3,started_at:new Date().toISOString(),retry_after:'2099-01-01',error:'Gemini (500)'};
const failedPost=structuredClone(posts[0]);
const retried=await Promise.all([createNewsJob(db,viewer,{retryPostId:'retry',writer}),createNewsJob(client(),viewer,{retryPostId:'retry',writer})]);
job=retried[0].job;
assert.equal(jobs.length,1); assert.equal(job.id,retried[1].job.id); assert.equal(job.retryPostId,'retry'); assert.equal(job.limit,1);
assert.deepEqual(posts[0],failedPost,'Enqueue does not clear a failure or rewrite an article');
await assert.rejects(createNewsJob(db,viewer,{retryPostId:'untouched',writer}),error=>error.cause===409);
await runNextNewsJob(client(),{jobId:job.id,writer});
assert.equal(calls,1); assert.equal(posts[0].content.automation.attempts,4); assert.equal(posts[0].author_id,'admin');
assert.equal(posts[1].content.automation,undefined); assert.equal((await getNewsJob(db,viewer.userId)).status,'completed');
await assert.rejects(createNewsJob(db,viewer,{retryPostId:'retry',writer}),error=>error.cause===409,'Written drafts cannot be retried');
await assert.rejects(createNewsJob(db,viewer,{retryPostId:'untouched',writer}),error=>error.cause===409,'Never-failed articles cannot use manual retry');

// Edits made while a retry is queued remain protected, and stale manual claims recover.
jobs=[]; posts=[structuredClone(failedPost)]; calls=0;
job=(await createNewsJob(db,viewer,{retryPostId:'retry',writer})).job;
posts[0].content.paragraphs=[]; posts[0].title='Human draft';
await runNextNewsJob(db,{jobId:job.id,writer});
assert.equal(calls,0); assert.equal(posts[0].title,'Human draft'); assert.equal((await getNewsJob(db,viewer.userId)).skipped,1);
jobs=[]; posts=[structuredClone(failedPost)];
job=(await createNewsJob(db,viewer,{retryPostId:'retry',writer})).job;
posts[0].content.automation={status:'writing',attempts:4,started_at:'2020-01-01',job_id:job.id};
await runNextNewsJob(client(),{jobId:job.id,writer});
assert.equal(calls,1); assert.equal((await getNewsJob(db,viewer.userId)).written,1,'Expired manual claims recover beyond the automatic attempt cap');
jobs=[]; posts=[structuredClone(failedPost)]; calls=0;
job=(await createNewsJob(db,viewer,{retryPostId:'retry',writer})).job;
failCheckpoint=true;
await assert.rejects(runNextNewsJob(db,{jobId:job.id,writer:async()=>{calls++;throw Error('Gemini (500)');}}),/진행 상태/);
jobs[0].lease_until='2020-01-01';
await runNextNewsJob(client(),{jobId:job.id,writer});
assert.equal(calls,1); assert.equal((await getNewsJob(db,viewer.userId)).failed,1,'A failed manual attempt is accounted for once without another AI call');
assert.equal(posts[0].title,'Original title'); assert.equal(posts[0].is_published,false);
jobs=[]; posts=[{...structuredClone(failedPost),is_published:true}];
await assert.rejects(createNewsJob(db,viewer,{retryPostId:'retry',writer}),error=>error.cause===409);
posts=[structuredClone(failedPost)]; role='editor';
await assert.rejects(createNewsJob(db,{userId:'editor',role},{retryPostId:'retry',writer}),error=>error.cause===409,'Editors cannot retry another author\'s article');
role='sub-admin';
await assert.rejects(createNewsJob(db,{userId:'sub',role},{retryPostId:'retry',writer}),error=>error.cause===409,'Sub-admin cannot retry admin articles');
role='admin';
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
const base=process.argv.find(arg=>arg.startsWith('http'));
if (base && process.argv.includes('--live-api')) {
  assert.equal(new URL(configuredUrl).hostname,'overgjynkrnwayfammid.supabase.co');
  const live=createClient(configuredUrl,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  const endpoint=new URL('/api/news/process',base);
  assert.equal((await fetch(endpoint,{method:'POST'})).status,401);
  let account, duplicatePost;
  try {
    const email=`archb-retry-qa-${randomUUID()}@example.com`,password=randomUUID()+randomUUID();
    const created=await live.auth.admin.createUser({email,password,email_confirm:true});
    assert.equal(created.error,null); account=created.data.user.id;
    const {createServerClient}=await import('@supabase/ssr');
    let cookies=[];
    const auth=createServerClient(configuredUrl,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>cookies,setAll:values=>{cookies=values;}}});
    assert.equal((await auth.auth.signInWithPassword({email,password})).error,null);
    const headers={'Content-Type':'application/json',Cookie:cookies.map(cookie=>`${cookie.name}=${cookie.value}`).join('; '),Origin:new URL(base).origin};
    const post=(body,extra={})=>fetch(endpoint,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
    assert.equal((await post({postId:randomUUID()})).status,403,'Normal accounts cannot retry');
    assert.equal((await live.from('users').update({role:'admin'}).eq('id',account)).error,null);
    assert.equal((await post({postId:'invalid'})).status,400);
    assert.equal((await post({postId:randomUUID()})).status,409,'Unknown articles do not enqueue');
    assert.equal((await post({postId:randomUUID(),padding:'x'.repeat(5000)})).status,413);
    assert.equal((await post({postId:randomUUID()},{Origin:'https://foreign.test'})).status,403);
    const published=await live.from('posts').select('id').eq('type','news').eq('is_published',true).limit(1).single();
    assert.equal(published.error,null);
    assert.equal((await post({postId:published.data.id})).status,409,'Published articles stay protected');
    const failed=await live.from('posts').select('id').eq('type','news').eq('content->automation->>status','failed').limit(1).single();
    assert.equal(failed.error,null);
    assert.equal((await live.from('users').update({role:'editor'}).eq('id',account)).error,null);
    assert.equal((await post({postId:failed.data.id})).status,409,'Editors cannot retry other owners');
    const queued=await live.from('news_jobs').select('id').eq('author_id',account);
    assert.equal(queued.error,null); assert.equal(queued.data.length,0,'Rejected requests never create jobs or call Gemini');

    const fixture={title:'ARCH.B 중복 검토 검증',summary:'검증용 미발행 기사',author_id:account,type:'news',slug:`archb-duplicate-qa-${randomUUID()}`,is_published:false,content:{format:NEWS_FORMAT,category:'design',source:'검증 매체',source_url:'https://example.com/archb-duplicate-check',original_title:'Duplicate check fixture',automation:{status:'duplicate',attempts:1,started_at:new Date().toISOString()},duplicate_review:{status:'pending',checked_at:new Date().toISOString(),matches:[{id:published.data.id,slug:'existing',title:'기존 발행 기사',source:'검증 매체',is_published:true,reason:'같은 소식'}]}}};
    const inserted=await live.from('posts').insert(fixture).select('id,content,title,summary,author_id,is_published').single();
    assert.equal(inserted.error,null); duplicatePost=inserted.data.id;
    const duplicateEndpoint=new URL(`/api/news/${duplicatePost}/duplicate`,base);
    const review=(body,extra={})=>fetch(duplicateEndpoint,{method:'PATCH',headers:{...headers,...extra},body:JSON.stringify(body)});
    assert.equal((await fetch(duplicateEndpoint,{method:'PATCH',body:JSON.stringify({decision:'allow'})})).status,401);
    assert.equal((await review({decision:'invalid'})).status,400);
    assert.equal((await review({decision:'allow',unexpected:true})).status,400);
    assert.equal((await review({decision:'allow'},{Origin:'https://foreign.test'})).status,403);
    assert.equal((await review({decision:'allow',padding:'x'.repeat(3000)})).status,413);
    assert.equal((await live.from('users').update({role:'user'}).eq('id',account)).error,null);
    assert.equal((await review({decision:'exclude'})).status,403);
    assert.equal((await live.from('users').update({role:'editor'}).eq('id',account)).error,null);
    assert.equal((await review({decision:'exclude'})).status,200,'An editor can review their own candidate');
    let saved=(await live.from('posts').select('content,title,summary,author_id,is_published').eq('id',duplicatePost).single()).data;
    assert.equal(saved.content.duplicate_review.status,'excluded');assert.equal(saved.content.duplicate_review.reviewed_by,account);
    for(const field of ['title','summary','author_id','is_published'])assert.deepEqual(saved[field],fixture[field]);
    assert.equal(saved.content.source_url,fixture.content.source_url);assert.equal(saved.content.paragraphs,undefined);
    assert.equal((await review({decision:'allow'})).status,200,'Exclusion is reversible');
    saved=(await live.from('posts').select('content').eq('id',duplicatePost).single()).data;
    assert.equal(saved.content.duplicate_review.status,'allowed');assert.equal(saved.content.automation,undefined);
    assert.equal((await review({decision:'allow'})).status,409,'Only held candidates can be reviewed');
    assert.equal((await live.from('posts').update({content:fixture.content}).eq('id',duplicatePost)).error,null);
    const simultaneous=await Promise.all([review({decision:'allow'}),review({decision:'allow'})]);
    assert.deepEqual(simultaneous.map(response=>response.status).sort(),[200,409],'Concurrent reviews cannot overwrite each other');
    assert.equal((await live.from('posts').update({content:{...fixture.content,paragraphs:[]}}).eq('id',duplicatePost)).error,null);
    assert.equal((await review({decision:'allow'})).status,409,'Even incomplete human drafts remain protected');
    assert.equal((await live.from('users').update({role:'admin'}).eq('id',account)).error,null);
    assert.equal((await fetch(new URL(`/api/news/${published.data.id}/duplicate`,base),{method:'PATCH',headers,body:JSON.stringify({decision:'exclude'})})).status,409,'Published articles cannot be excluded');
  } finally {
    if(duplicatePost)assert.equal((await live.from('posts').delete().eq('id',duplicatePost).eq('author_id',account).eq('is_published',false)).error,null);
    if(account) assert.equal((await live.auth.admin.deleteUser(account)).error,null);
  }
}
console.log('Durable news job checks passed: duplicate submissions, one-article steps, browser abort, process-independent progress, leases, checkpoint recovery, provider errors, private accounts and worker authentication.');
