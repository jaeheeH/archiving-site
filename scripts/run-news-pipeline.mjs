import { parseArgs } from 'node:util';
import { createAdminClient } from '../lib/supabase/admin.ts';
import { assertNewsProject, getNewsViewer, newsWritingQueue } from '../lib/news-pipeline.ts';
import { createNewsJob, getNewsJob, newsJobActive, runNextNewsJob } from '../lib/news-jobs.ts';

const { values } = parseArgs({ options: { author: { type: 'string' }, limit: { type: 'string', default: '15' }, 'dry-run': { type: 'boolean' }, 'skip-collect': { type: 'boolean' }, 'enqueue-only': { type: 'boolean' } } });
const limit = Number(values.limit);
if (!values.author || !/^[0-9a-f-]{36}$/i.test(values.author) || !Number.isInteger(limit) || limit < 1 || limit > 15) throw new Error('기존 작성자 계정 --author와 1~15 범위 --limit이 필요합니다.');
assertNewsProject(process.env.NEXT_PUBLIC_SUPABASE_URL);
const db = createAdminClient({ timeoutMs: 15000 });
const viewer = await getNewsViewer(db, values.author);
const before = await newsWritingQueue(db, viewer);
console.log(JSON.stringify({ stage: 'queue', ...before }));
if (!values['dry-run']) {
  if (!process.env.GEMINI_API_KEY) throw new Error('Gemini API 설정이 필요합니다.');
  let { job } = await createNewsJob(db, viewer, { limit, withCollection: !values['skip-collect'] });
  console.log(JSON.stringify({ stage: 'queued', ...job }));
  let previous = JSON.stringify(job);
  while (!values['enqueue-only'] && newsJobActive(job)) {
    // The browser/server and this daily runner share the DB lease; neither can duplicate a step.
    try { await runNextNewsJob(db, { jobId: job.id }); }
    catch (cause) { console.error(cause instanceof Error ? cause.message : 'Worker interrupted; the DB job will retry.'); }
    job = await getNewsJob(db, viewer.userId, job.id);
    if (!job) throw new Error('DB에 저장한 뉴스 작업을 찾지 못했습니다.');
    const current = JSON.stringify(job);
    if (current !== previous) { console.log(JSON.stringify({ stage: 'progress', ...job })); previous = current; }
    if (newsJobActive(job)) await new Promise(resolve => setTimeout(resolve, 10000));
  }
  console.log(JSON.stringify({ stage: values['enqueue-only'] ? 'submitted' : 'complete', ...job }));
  if (job.status === 'failed' || job.failed || job.collectionErrors) process.exitCode = 1;
}
