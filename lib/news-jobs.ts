import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { collectNewsInto, writePendingNews, type NewsViewer } from './news-pipeline';

export type NewsJob = {
  id: string; status: 'queued' | 'collecting' | 'writing' | 'completed' | 'failed';
  withCollection: boolean; limit: number; startedAt: string; finishedAt?: string;
  written: number; failed: number; skipped: number; collected: number; collectionErrors: number;
  remaining: number; currentTitle: string; error?: string;
};
export type NewsProcessStatus = { waiting: number; writing: number; failed: number; job: NewsJob | null };
export const newsJobActive = (job?: NewsJob | null) => !!job && ['queued', 'collecting', 'writing'].includes(job.status);
const fatalProviderError = /사용량 한도|Gemini.+요청.+(?:401|403)|API key not valid/i;

// ponytail: one Node server keeps live job progress; use a durable shared queue for multiple server instances.
const runtime = globalThis as typeof globalThis & { archbNewsJobs?: Map<string, NewsJob> };
const jobs = runtime.archbNewsJobs ??= new Map<string, NewsJob>();

export function getNewsJob(userId: string) {
  const job = jobs.get(userId);
  if (newsJobActive(job) && Date.now() - Date.parse(job!.startedAt) > 50 * 60_000) {
    Object.assign(job!, { status: 'failed', currentTitle: '', finishedAt: new Date().toISOString(), error: '서버 작업 시간이 만료되었습니다. 저장된 초안은 보존되며 미완료 기사는 다시 처리할 수 있습니다.' });
  }
  return job || null;
}

export function createNewsJob(db: SupabaseClient, viewer: NewsViewer, options: { withCollection?: boolean; limit?: number; writer?: NonNullable<Parameters<typeof writePendingNews>[2]>['writer'] } = {}) {
  const limit = options.limit ?? 15;
  if (!Number.isInteger(limit) || limit < 1 || limit > 15) throw new Error('한 번에 1~15편을 작성할 수 있습니다.');
  const current = getNewsJob(viewer.userId);
  if (newsJobActive(current)) return { job: current!, run: null };
  if (!options.writer && !process.env.GEMINI_API_KEY) throw new Error('Gemini API 설정이 필요합니다.');
  const job: NewsJob = { id: randomUUID(), status: 'queued', withCollection: !!options.withCollection, limit, startedAt: new Date().toISOString(), written: 0, failed: 0, skipped: 0, collected: 0, collectionErrors: 0, remaining: 0, currentTitle: '' };
  jobs.set(viewer.userId, job);
  let started = false;
  const run = async () => {
    if (started) return;
    started = true;
    try {
      if (job.withCollection) {
        job.status = 'collecting';
        const collection = await collectNewsInto(db, viewer.userId);
        job.collected = collection.results.reduce((sum, item) => sum + item.inserted, 0);
        job.collectionErrors = collection.results.filter(item => item.error).length;
      }
      job.status = 'writing';
      const result = await writePendingNews(db, viewer, { limit, writer: options.writer, signal: AbortSignal.timeout(50 * 60_000), onProgress: item => {
        if (item.status === 'writing') job.currentTitle = item.title;
        else { job.currentTitle = ''; if (item.status === 'ready') job.written++; if (item.status === 'failed') job.failed++; if (item.status === 'skipped') job.skipped++; }
      } });
      Object.assign(job, { written: result.written, failed: result.failed, skipped: result.skipped, remaining: result.remaining });
      const fatal = result.items.find(item => fatalProviderError.test(item.error || ''));
      if (fatal) throw new Error(fatal.error);
      job.status = 'completed';
    } catch (cause) {
      job.status = 'failed';
      job.error = cause instanceof Error ? cause.message.slice(0, 500) : '서버 자동 작성에 실패했습니다.';
    } finally { job.currentTitle = ''; job.finishedAt = new Date().toISOString(); }
  };
  return { job, run };
}
