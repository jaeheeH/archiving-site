import { createHash, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertNewsProject, canAutoWrite, canRetryNews, collectNewsInto, getNewsViewer, readQueuedNews, selectPendingNews, writePendingNews, type NewsViewer } from './news-pipeline';
import { createAdminClient } from './supabase/admin';
import { getSiteUrl } from './site-url';

export type NewsJob = {
  id: string; status: 'queued' | 'collecting' | 'writing' | 'completed' | 'failed';
  withCollection: boolean; limit: number; startedAt: string; finishedAt?: string;
  written: number; failed: number; skipped: number; duplicates: number; collected: number; collectionErrors: number;
  remaining: number; currentTitle: string; error?: string; retryPostId?: string; processed: number; queued: number;
};
export type NewsProcessStatus = { waiting: number; writing: number; failed: number; duplicates: number; job: NewsJob | null };
export const newsJobActive = (job?: NewsJob | null) => !!job && ['queued', 'collecting', 'writing'].includes(job.status);
const fatalProviderError = /사용량 한도|Gemini.+요청.+(?:401|403)|API key not valid/i;
type JobState = Omit<NewsJob, 'id' | 'status' | 'processed' | 'queued'> & {
  collectionDone: boolean; planned: boolean; postIds: string[]; cursor: number;
  items: { id: string; status: 'ready' | 'failed' | 'skipped' | 'duplicate'; error?: string }[];
};
type JobRow = { id: string; author_id: string; status: NewsJob['status']; state: JobState; lease_token: string; lease_attempts: number };
type Writer = NonNullable<Parameters<typeof writePendingNews>[2]>['writer'];
const activeStatuses = ['queued', 'collecting', 'writing'];

function publicJob(row: JobRow): NewsJob {
  const s = row.state;
  return { id: row.id, status: row.status, withCollection: s.withCollection, limit: s.limit, startedAt: s.startedAt,
    finishedAt: s.finishedAt, written: s.written, failed: s.failed, skipped: s.skipped, collected: s.collected,
    collectionErrors: s.collectionErrors, duplicates: s.duplicates || 0, remaining: s.remaining, currentTitle: s.currentTitle, error: s.error, retryPostId: s.retryPostId,
    processed: s.cursor, queued: Math.max(0, s.postIds.length - s.cursor) };
}

export async function getNewsJob(db: SupabaseClient, userId: string, id?: string) {
  let query = db.from('news_jobs').select('*').eq('author_id', userId);
  if (id) query = query.eq('id', id);
  const result = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error('저장된 뉴스 작업 상태를 불러오지 못했습니다.');
  return result.data ? publicJob(result.data as JobRow) : null;
}

export async function createNewsJob(db: SupabaseClient, viewer: NewsViewer, options: { withCollection?: boolean; limit?: number; retryPostId?: string; writer?: Writer } = {}) {
  const limit = options.retryPostId ? 1 : options.limit ?? 15;
  if (!Number.isInteger(limit) || limit < 1 || limit > 15) throw new Error('한 번에 1~15편을 작성할 수 있습니다.');
  if ((await getNewsViewer(db, viewer.userId)).role !== viewer.role) throw new Error('뉴스를 작성할 권한이 없습니다.');
  const reuse = (row: JobRow) => {
    if (options.retryPostId && row.state.retryPostId !== options.retryPostId) throw new Error('진행 중인 자동 작성이 끝난 뒤 다시 요청해주세요.', { cause: 409 });
    return { job: publicJob(row), created: false };
  };
  const current = await db.from('news_jobs').select('*').eq('author_id', viewer.userId).in('status', activeStatuses).maybeSingle();
  if (current.error) throw new Error('뉴스 작업 큐를 확인하지 못했습니다.');
  if (current.data) return reuse(current.data as JobRow);
  if (options.retryPostId) {
    const post = await readQueuedNews(db, viewer, options.retryPostId);
    if (options.withCollection || !post || !canRetryNews(post)) throw new Error('작성에 실패한 미작성 뉴스만 다시 작성할 수 있습니다. 목록을 새로고침해주세요.', { cause: 409 });
  }
  if (!options.writer && !process.env.GEMINI_API_KEY) throw new Error('Gemini API 설정이 필요합니다.');
  const state: JobState = { withCollection: !!options.withCollection, limit, startedAt: new Date().toISOString(),
    written: 0, failed: 0, skipped: 0, duplicates: 0, collected: 0, collectionErrors: 0, remaining: 0, currentTitle: '',
    collectionDone: !options.withCollection, planned: !!options.retryPostId, postIds: options.retryPostId ? [options.retryPostId] : [], cursor: 0, items: [],
    ...(options.retryPostId ? { retryPostId: options.retryPostId, remaining: 1 } : {}) };
  const inserted = await db.from('news_jobs').insert({ author_id: viewer.userId, state }).select('*').single();
  if (inserted.error?.code === '23505') {
    const duplicate = await db.from('news_jobs').select('*').eq('author_id', viewer.userId).in('status', activeStatuses).single();
    if (duplicate.error) throw new Error('동시에 접수된 뉴스 작업을 확인하지 못했습니다.');
    return reuse(duplicate.data as JobRow);
  }
  if (inserted.error) throw new Error('뉴스 작업을 DB 큐에 저장하지 못했습니다.');
  return { job: publicJob(inserted.data as JobRow), created: true };
}

// One invocation performs collection, queue planning, or ONE article; no 50-minute callback.
export async function runNextNewsJob(db: SupabaseClient, options: { jobId?: string; writer?: Writer } = {}) {
  assertNewsProject(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const claimed = await db.rpc('claim_news_job', { p_job_id: options.jobId || null });
  if (claimed.error) throw new Error('뉴스 작업을 선점하지 못했습니다.');
  const row = claimed.data?.[0] as JobRow | undefined;
  if (!row) return null;
  const state = structuredClone(row.state);
  let status = row.status;
  const save = async (release: boolean, nextRunAt = new Date().toISOString()) => {
    const result = await db.from('news_jobs').update({ state, status, updated_at: new Date().toISOString(),
      ...(release ? { lease_token: null, lease_until: null, lease_attempts: 0, next_run_at: nextRunAt } : {}) })
      .eq('id', row.id).eq('lease_token', row.lease_token).select('id').maybeSingle();
    if (result.error) throw new Error('뉴스 작업의 진행 상태를 저장하지 못했습니다.');
    if (!result.data) throw new Error('작업 선점이 만료되었습니다. 다음 서버 실행이 이어 처리합니다.');
  };
  try {
    const viewer = await getNewsViewer(db, row.author_id);
    if (!options.writer && !process.env.GEMINI_API_KEY) throw new Error('Gemini API 설정이 필요합니다.');
    if (!state.collectionDone) {
      status = 'collecting'; await save(false);
      const collection = await collectNewsInto(db, row.author_id, row.id);
      state.collected = collection.inserted;
      state.collectionErrors = collection.results.filter(item => item.error).length;
      state.collectionDone = true; status = 'queued';
    } else if (!state.planned) {
      const pending = await selectPendingNews(db, viewer);
      // ponytail: at most 15 IDs per batch; separate task rows if parallel batch writing is needed.
      state.postIds = pending.slice(0, state.limit).map(post => post.id);
      state.remaining = pending.length; state.planned = true; status = 'writing';
    } else {
      const id = state.postIds[state.cursor];
      const post = id ? await readQueuedNews(db, viewer, id) : null;
      if (id) {
        let item: JobState['items'][number] = { id, status: 'skipped' };
        if (post?.content.automation?.job_id === row.id && ['ready', 'failed', 'duplicate'].includes(post.content.automation.status)) {
          // The article committed before a server crash; account for it without another AI call.
          item = { id, status: post.content.automation.status as 'ready' | 'failed' | 'duplicate', error: post.content.automation.error };
        } else if (post && (state.retryPostId === id ? canRetryNews(post, row.id) : canAutoWrite(post))) {
          state.currentTitle = post.title; status = 'writing'; await save(false);
          const result = await writePendingNews(db, viewer, { limit: 1, postId: id, jobId: row.id,
            manualRetry: state.retryPostId === id, writer: options.writer, signal: AbortSignal.timeout(240_000) });
          item = result.items[0] || item;
          state.remaining = result.remaining;
        } else if (post?.content.automation?.status === 'writing' && post.content.automation.job_id === row.id) {
          // A lease should outlive the article claim; preserve it if clocks differ slightly.
          await save(true, new Date(Date.parse(post.content.automation.started_at) + 10 * 60_000 + 1000).toISOString());
          return publicJob({ ...row, state, status });
        }
        state.items.push(item); state.cursor++; state.currentTitle = '';
        state.written = state.items.filter(item => item.status === 'ready').length;
        state.failed = state.items.filter(item => item.status === 'failed').length;
        state.duplicates = state.items.filter(item => item.status === 'duplicate').length;
        state.skipped = state.items.filter(item => item.status === 'skipped').length;
        if (fatalProviderError.test(item.error || '')) { status = 'failed'; state.error = item.error; }
      }
    }
    if (status !== 'failed' && state.planned && state.cursor >= state.postIds.length) status = 'completed';
    if (status === 'completed' || status === 'failed') state.finishedAt = new Date().toISOString();
    await save(true);
  } catch (cause) {
    // Transient DB/network failures retain the lease for bounded recovery, not a lost batch.
    const error = cause instanceof Error ? cause.message : '뉴스 작업에 실패했습니다.';
    if (!fatalProviderError.test(error) && !/뉴스를 작성할 권한이 없습니다|Gemini API 설정이 필요/.test(error)) throw cause;
    status = 'failed'; state.currentTitle = ''; state.finishedAt = new Date().toISOString();
    state.error = error.slice(0, 500);
    await save(true);
  }
  return publicJob({ ...row, state, status });
}

export async function configureNewsWorker(db: SupabaseClient) {
  if (process.env.VERCEL_ENV !== 'production') return;
  const endpoint = `${getSiteUrl()}/api/news/worker`;
  if (!/^https:\/\/(www\.)?archbehind\.com\/api\/news\/worker$/.test(endpoint)) throw new Error('ARCH.B 운영 도메인을 확인해주세요.');
  const result = await db.from('news_worker_config').update({ endpoint, enabled: true, updated_at: new Date().toISOString() }).eq('singleton', true);
  if (result.error) throw new Error('운영 서버의 뉴스 작업 스케줄러를 연결하지 못했습니다.');
}

export async function authorizeNewsWorker(db: SupabaseClient, authorization: string | null) {
  if (!authorization || !/^Bearer [a-f0-9]{64}$/.test(authorization)) return false;
  const result = await db.from('news_worker_config').select('token_sha256').eq('singleton', true).single();
  if (result.error) throw new Error('뉴스 작업 서버 인증 설정을 확인하지 못했습니다.');
  const provided = createHash('sha256').update(authorization.slice(7)).digest();
  const expected = Buffer.from(result.data.token_sha256, 'hex');
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function startLocalNewsWorker() {
  const runtime = globalThis as typeof globalThis & { archbNewsWorkerStarted?: boolean };
  if (runtime.archbNewsWorkerStarted) return;
  runtime.archbNewsWorkerStarted = true;
  const db = createAdminClient({ timeoutMs: 15000 });
  const tick = async () => {
    let worked = false;
    try { worked = !!await runNextNewsJob(db); }
    catch (cause) { console.error('ARCH.B news worker:', cause instanceof Error ? cause.message : 'Worker failed'); }
    setTimeout(tick, worked ? 1000 : 15000).unref();
  };
  setTimeout(tick, 1000).unref();
}
