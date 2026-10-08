import type { SupabaseClient } from '@supabase/supabase-js';
import { FEEDS, fetchFeed } from './news-feeds';
import { NEWS_FORMAT, newsPost } from './news-record';
import { editorialSchema } from './news-editorial';
import { researchNews, type ResearchResult } from './news-research';
import { DuplicateNewsError, duplicateCandidates, type DuplicateCandidate, type DuplicateReview } from './news-duplicates';

export type NewsViewer = { userId: string; role: string };
export type WritingState = { status: 'writing' | 'ready' | 'failed' | 'duplicate'; attempts: number; started_at: string; finished_at?: string; retry_after?: string; error?: string; job_id?: string };
type PendingPost = { id: string; title: string; author_id: string | null; updated_at: string; is_published: boolean; content: Record<string, unknown> & { format?: string; source_url?: string; original_title?: string; source?: string; category?: string; source_published_at?: string; source_text?: string; paragraphs?: unknown; automation?: WritingState; duplicate_review?: DuplicateReview } };
type Writer = typeof researchNews;
const editorRoles = ['admin', 'sub-admin', 'editor'];

export function assertNewsProject(url: string) {
  if (new URL(url).hostname !== 'overgjynkrnwayfammid.supabase.co') throw new Error('ARCH.B Supabase 프로젝트 연결을 확인해주세요.');
}

export async function getNewsViewer(db: SupabaseClient, userId: string): Promise<NewsViewer> {
  const user = await db.from('users').select('role').eq('id', userId).single();
  if (user.error) throw new Error('뉴스 작성자 계정을 조회하지 못했습니다.');
  if (!editorRoles.includes(user.data?.role)) throw new Error('뉴스를 작성할 권한이 없습니다.');
  return { userId, role: user.data.role };
}

async function authorizedScope(db: SupabaseClient, viewer: NewsViewer) {
  if ((await getNewsViewer(db, viewer.userId)).role !== viewer.role) throw new Error('뉴스를 작성할 권한이 없습니다.');
  if (viewer.role !== 'sub-admin') return [] as string[];
  const admins = await db.from('users').select('id').eq('role', 'admin');
  if (admins.error) throw new Error('작성자 권한을 확인하지 못했습니다.');
  return (admins.data || []).map(row => row.id as string);
}

export async function collectNewsInto(db: SupabaseClient, authorId: string, jobId?: string) {
  const results = await Promise.all(FEEDS.map(async feed => {
    try {
      const articles = await fetchFeed(feed);
      if (!articles.length) return { source: feed.name, checked: 0, inserted: 0, error: null };
      const saved = await db.from('posts').upsert(articles.map(article => {
        const post = newsPost(article);
        return { ...post, author_id: authorId, content: { ...post.content, ...(jobId ? { collection_job_id: jobId } : {}) } };
      }), { onConflict: 'slug', ignoreDuplicates: true }).select('id');
      if (saved.error) throw saved.error;
      return { source: feed.name, checked: articles.length, inserted: saved.data?.length || 0, error: null };
    } catch (cause) { return { source: feed.name, checked: 0, inserted: 0, error: cause instanceof Error ? cause.message.slice(0, 200) : '수집 실패' }; }
  }));
  // Count persisted inserts, including those committed before a lost job checkpoint.
  let inserted = results.reduce((sum, item) => sum + item.inserted, 0);
  if (jobId) {
    const count = await db.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', authorId).eq('content->>collection_job_id', jobId);
    if (count.error) throw new Error('수집한 기사 수를 확인하지 못했습니다.');
    inserted = count.count || 0;
  }
  return { results, inserted };
}

function isUnwrittenNews(post: Pick<PendingPost, 'is_published' | 'content'>) {
  return !post.is_published && post.content?.format === NEWS_FORMAT && !!post.content.source_url && post.content.paragraphs === undefined;
}

export function canRetryNews(post: Pick<PendingPost, 'is_published' | 'content'>, jobId?: string, now = Date.now()) {
  const state = post.content.automation;
  return isUnwrittenNews(post) && (state?.status === 'failed' || (!!jobId && state?.status === 'writing' && state.job_id === jobId && now - Date.parse(state.started_at) >= 10 * 60_000));
}

export function canAutoWrite(post: PendingPost, now = Date.now()) {
  if (!isUnwrittenNews(post)) return false;
  const state = post.content.automation;
  if (!state) return true;
  if (state.status === 'ready' || state.status === 'duplicate' || state.attempts >= 3) return false;
  if (state.status === 'writing' && now - Date.parse(state.started_at) < 10 * 60_000) return false;
  return !state.retry_after || Date.parse(state.retry_after) <= now;
}

async function pendingRows(db: SupabaseClient, viewer: NewsViewer, options: { postId?: string; includeWritten?: boolean } = {}) {
  const admins = await authorizedScope(db, viewer);
  let query = db.from('posts').select('id,title,author_id,updated_at,is_published,content').eq('type', 'news').eq('is_published', false).order('created_at', { ascending: false });
  if (!options.includeWritten) query = query.is('content->paragraphs', null);
  if (options.postId) query = query.eq('id', options.postId);
  if (viewer.role === 'editor') query = query.eq('author_id', viewer.userId);
  if (admins.length) query = query.not('author_id', 'in', `(${admins.join(',')})`);
  const rows: PendingPost[] = [];
  // Read pages so a growing queue never silently loses its older items.
  for (let offset = 0; ; offset += 500) {
    const result = await query.range(offset, offset + 499);
    if (result.error) throw new Error('가공 대기 뉴스를 불러오지 못했습니다.');
    rows.push(...(result.data || []) as PendingPost[]);
    if ((result.data?.length || 0) < 500) break;
  }
  return rows;
}

export async function newsWritingQueue(db: SupabaseClient, viewer: NewsViewer) {
  const rows = await pendingRows(db, viewer);
  return { waiting: rows.filter(row => canAutoWrite(row)).length, writing: rows.filter(row => row.content.automation?.status === 'writing' && !canAutoWrite(row)).length, failed: rows.filter(row => row.content.automation?.status === 'failed').length, duplicates: rows.filter(row => row.content.automation?.status === 'duplicate' && row.content.duplicate_review?.status === 'pending').length };
}

async function readDuplicateCandidates(db: SupabaseClient, viewer: NewsViewer, post: PendingPost) {
  const existing: DuplicateCandidate[] = [];
  // Only public articles and this author's drafts can be shown as comparison targets.
  const query = db.from('posts').select('id,slug,title,summary,is_published,original_title:content->>original_title,source_url:content->>source_url,source:content->>source,source_published_at:content->>source_published_at')
    .eq('type', 'news').neq('id', post.id).not('content->paragraphs', 'is', null).or(`is_published.eq.true,author_id.eq.${viewer.userId}`).order('id');
  for (let offset = 0; ; offset += 500) {
    const result = await query.range(offset, offset + 499);
    if (result.error) throw new Error('중복 비교용 기사를 불러오지 못했습니다.');
    existing.push(...result.data as DuplicateCandidate[]);
    if (result.data.length < 500) break;
  }
  return duplicateCandidates({ url: post.content.source_url!, title: post.content.original_title || post.title, source: post.content.source || '', publishedAt: post.content.source_published_at }, existing.filter(candidate => candidate.id !== post.id));
}

export async function readQueuedNews(db: SupabaseClient, viewer: NewsViewer, postId: string) {
  return (await pendingRows(db, viewer, { postId, includeWritten: true }))[0] || null;
}

export async function selectPendingNews(db: SupabaseClient, viewer: NewsViewer) {
  const rows = (await pendingRows(db, viewer)).filter(row => canAutoWrite(row));
  rows.sort((a, b) => Date.parse(b.content.source_published_at || b.updated_at) - Date.parse(a.content.source_published_at || a.updated_at));
  // Prioritize publishers not recently attempted, including across daily batches smaller than the source count.
  const history = await db.from('posts').select('source:content->>source,updated_at').eq('type', 'news').not('content->automation->>started_at', 'is', null).order('updated_at', { ascending: false }).limit(500);
  if (history.error) throw new Error('매체별 작성 기록을 확인하지 못했습니다.');
  const lastAttempt = new Map<string, number>();
  for (const row of history.data || []) if (row.source && !lastAttempt.has(row.source)) lastAttempt.set(row.source, Date.parse(row.updated_at));
  // ponytail: the latest 500 attempts cover the current 23 feeds; persist a per-source cursor if the catalog grows beyond this window.
  const queues = [...new Set(rows.map(row => row.content.source))].sort((a, b) => (lastAttempt.get(a || '') || 0) - (lastAttempt.get(b || '') || 0)).map(source => rows.filter(row => row.content.source === source));
  const ordered: PendingPost[] = [];
  while (queues.some(queue => queue.length)) for (const queue of queues) { const row = queue.shift(); if (row) ordered.push(row); }
  return ordered;
}

export async function writePendingNews(db: SupabaseClient, viewer: NewsViewer, options: { limit?: number; postId?: string; manualRetry?: boolean; jobId?: string; signal?: AbortSignal; writer?: Writer; onProgress?: (result: { id: string; title: string; status: string; error?: string }) => void } = {}) {
  const limit = options.limit ?? 1;
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('한 번에 1~25편을 작성할 수 있습니다.');
  if (options.manualRetry && (!options.postId || limit !== 1)) throw new Error('수동 재작성은 실패한 기사 한 편만 요청할 수 있습니다.');
  if (!options.writer && !process.env.GEMINI_API_KEY) throw new Error('Gemini API 설정이 필요합니다.');
  const ordered = options.postId ? (await pendingRows(db, viewer, { postId: options.postId })).filter(row => options.manualRetry ? canRetryNews(row, options.jobId) : canAutoWrite(row)) : await selectPendingNews(db, viewer);
  const items: { id: string; title: string; status: 'ready' | 'failed' | 'skipped' | 'duplicate'; error?: string }[] = [];
  for (const post of ordered) {
    if (items.filter(item => item.status !== 'skipped').length >= limit || options.signal?.aborted) break;
    const started = new Date().toISOString();
    const state: WritingState = { status: 'writing', started_at: started, attempts: (post.content.automation?.attempts || 0) + 1, ...(options.jobId ? { job_id: options.jobId } : {}) };
    const claim = await db.from('posts').update({ content: { ...post.content, automation: state }, updated_at: started }).eq('id', post.id).filter('author_id', post.author_id === null ? 'is' : 'eq', post.author_id || 'null').eq('updated_at', post.updated_at).eq('is_published', false).select('updated_at').maybeSingle();
    if (claim.error) throw new Error('기사 작성 상태를 저장하지 못했습니다.');
    if (!claim.data) { items.push({ id: post.id, title: post.title, status: 'skipped' }); continue; }
    options.onProgress?.({ id: post.id, title: post.title, status: 'writing' });
    try {
      const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(180_000)]) : AbortSignal.timeout(180_000);
      const candidates = post.content.duplicate_review?.status === 'allowed' ? [] : await readDuplicateCandidates(db, viewer, post);
      const result: ResearchResult = await (options.writer || researchNews)({ url: post.content.source_url!, title: post.content.original_title || post.title, source: post.content.source || '', category: post.content.category || '', sourceText: (post.content.source_text || '').slice(0, 6000), publishedAt: post.content.source_published_at, duplicateCandidates: candidates }, signal);
      const article = editorialSchema.parse(result.article);
      if (article.url !== post.content.source_url) throw new Error('조사 결과의 원출처가 일치하지 않습니다.');
      const admins = await authorizedScope(db, viewer);
      if (viewer.role === 'sub-admin' && post.author_id && admins.includes(post.author_id)) throw new Error('관리자 작성 기사는 가공할 수 없습니다.');
      const saved = await db.from('posts').update({ title: article.title, summary: article.summary, tags: article.tags, content: { ...post.content, paragraphs: article.paragraphs, points: article.points, research: result.research, duplicate_review: undefined, automation: { ...state, status: 'ready', finished_at: new Date().toISOString() } }, updated_at: new Date().toISOString() }).eq('id', post.id).filter('author_id', post.author_id === null ? 'is' : 'eq', post.author_id || 'null').eq('updated_at', claim.data.updated_at).eq('is_published', false).select('id').maybeSingle();
      if (saved.error) throw new Error('작성한 초안을 저장하지 못했습니다.');
      items.push({ id: post.id, title: article.title, status: saved.data ? 'ready' : 'skipped' });
    } catch (cause) {
      const error = cause instanceof Error ? cause.message.slice(0, 500) : '자동 작성에 실패했습니다.';
      const duplicate = cause instanceof DuplicateNewsError;
      const finished = new Date().toISOString();
      const failed = await db.from('posts').update({ content: { ...post.content, ...(duplicate ? { duplicate_review: { status: 'pending', checked_at: finished, matches: cause.matches } } : {}), automation: { ...state, status: duplicate ? 'duplicate' : 'failed', finished_at: finished, ...(duplicate ? {} : { retry_after: new Date(Date.now() + 60 * 60_000).toISOString(), error }) } }, updated_at: finished }).eq('id', post.id).filter('author_id', post.author_id === null ? 'is' : 'eq', post.author_id || 'null').eq('updated_at', claim.data.updated_at).eq('is_published', false).select('id').maybeSingle();
      if (failed.error) throw new Error('작성 실패 상태를 저장하지 못했습니다.');
      items.push({ id: post.id, title: post.title, status: failed.data ? duplicate ? 'duplicate' : 'failed' : 'skipped', ...(duplicate ? {} : { error }) });
    }
    options.onProgress?.(items.at(-1)!);
    if (/사용량 한도|Gemini.+요청.+(?:401|403)|API key not valid/i.test(items.at(-1)?.error || '')) break;
  }
  return { written: items.filter(item => item.status === 'ready').length, failed: items.filter(item => item.status === 'failed').length, duplicates: items.filter(item => item.status === 'duplicate').length, skipped: items.filter(item => item.status === 'skipped').length, items, remaining: (await newsWritingQueue(db, viewer)).waiting };
}
