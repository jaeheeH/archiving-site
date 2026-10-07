import type { SupabaseClient } from '@supabase/supabase-js';
import { FEEDS, fetchFeed } from './news-feeds';
import { NEWS_FORMAT, newsPost } from './news-record';
import { editorialSchema } from './news-editorial';
import { researchNews, type ResearchResult } from './news-research';

export type NewsViewer = { userId: string; role: string };
export type WritingState = { status: 'writing' | 'ready' | 'failed'; attempts: number; started_at: string; finished_at?: string; retry_after?: string; error?: string };
type PendingPost = { id: string; title: string; author_id: string | null; updated_at: string; is_published: boolean; content: Record<string, unknown> & { format?: string; source_url?: string; original_title?: string; source?: string; category?: string; source_published_at?: string; source_text?: string; paragraphs?: unknown; automation?: WritingState } };
type Writer = typeof researchNews;
const editorRoles = ['admin', 'sub-admin', 'editor'];

export function assertNewsProject(url: string) {
  if (new URL(url).hostname !== 'overgjynkrnwayfammid.supabase.co') throw new Error('ARCH.B Supabase 프로젝트 연결을 확인해주세요.');
}

async function authorizedScope(db: SupabaseClient, viewer: NewsViewer) {
  const user = await db.from('users').select('role').eq('id', viewer.userId).single();
  if (user.error || user.data?.role !== viewer.role || !editorRoles.includes(viewer.role)) throw new Error('뉴스를 작성할 권한이 없습니다.');
  if (viewer.role !== 'sub-admin') return [] as string[];
  const admins = await db.from('users').select('id').eq('role', 'admin');
  if (admins.error) throw new Error('작성자 권한을 확인하지 못했습니다.');
  return (admins.data || []).map(row => row.id as string);
}

export async function collectNewsInto(db: SupabaseClient, authorId: string) {
  const results = await Promise.all(FEEDS.map(async feed => {
    try {
      const articles = await fetchFeed(feed);
      const saved = await db.from('posts').upsert(articles.map(article => ({ ...newsPost(article), author_id: authorId })), { onConflict: 'slug', ignoreDuplicates: true }).select('id');
      if (saved.error) throw saved.error;
      return { source: feed.name, checked: articles.length, inserted: saved.data?.length || 0, error: null };
    } catch (cause) { return { source: feed.name, checked: 0, inserted: 0, error: cause instanceof Error ? cause.message.slice(0, 200) : '수집 실패' }; }
  }));
  return { results };
}

export function canAutoWrite(post: PendingPost, now = Date.now()) {
  if (post.is_published || post.content?.format !== NEWS_FORMAT || !post.content.source_url || post.content.paragraphs !== undefined) return false;
  const state = post.content.automation;
  if (!state) return true;
  if (state.status === 'ready' || state.attempts >= 3) return false;
  if (state.status === 'writing' && now - Date.parse(state.started_at) < 10 * 60_000) return false;
  return !state.retry_after || Date.parse(state.retry_after) <= now;
}

async function pendingRows(db: SupabaseClient, viewer: NewsViewer) {
  const admins = await authorizedScope(db, viewer);
  let query = db.from('posts').select('id,title,author_id,updated_at,is_published,content').eq('type', 'news').eq('is_published', false).is('content->paragraphs', null).order('created_at', { ascending: false });
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
  return { waiting: rows.filter(row => canAutoWrite(row)).length, writing: rows.filter(row => row.content.automation?.status === 'writing' && !canAutoWrite(row)).length, failed: rows.filter(row => row.content.automation?.status === 'failed').length };
}

export async function writePendingNews(db: SupabaseClient, viewer: NewsViewer, options: { limit?: number; signal?: AbortSignal; writer?: Writer; onProgress?: (result: { id: string; title: string; status: string; error?: string }) => void } = {}) {
  const limit = options.limit ?? 1;
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('한 번에 1~25편을 작성할 수 있습니다.');
  if (!options.writer && !process.env.GEMINI_API_KEY) throw new Error('Gemini API 설정이 필요합니다.');
  const rows = (await pendingRows(db, viewer)).filter(row => canAutoWrite(row));
  rows.sort((a, b) => Date.parse(b.content.source_published_at || b.updated_at) - Date.parse(a.content.source_published_at || a.updated_at));
  // Round-robin by publisher keeps a large feed from starving the other fields.
  const queues = [...new Set(rows.map(row => row.content.source))].map(source => rows.filter(row => row.content.source === source));
  const ordered: PendingPost[] = [];
  while (queues.some(queue => queue.length)) for (const queue of queues) { const row = queue.shift(); if (row) ordered.push(row); }
  const items: { id: string; title: string; status: 'ready' | 'failed' | 'skipped'; error?: string }[] = [];
  for (const post of ordered) {
    if (items.filter(item => item.status !== 'skipped').length >= limit || options.signal?.aborted) break;
    const started = new Date().toISOString();
    const state: WritingState = { status: 'writing', started_at: started, attempts: (post.content.automation?.attempts || 0) + 1 };
    const claim = await db.from('posts').update({ content: { ...post.content, automation: state }, updated_at: started }).eq('id', post.id).filter('author_id', post.author_id === null ? 'is' : 'eq', post.author_id || 'null').eq('updated_at', post.updated_at).eq('is_published', false).select('updated_at').maybeSingle();
    if (claim.error) throw new Error('기사 작성 상태를 저장하지 못했습니다.');
    if (!claim.data) { items.push({ id: post.id, title: post.title, status: 'skipped' }); continue; }
    options.onProgress?.({ id: post.id, title: post.title, status: 'writing' });
    try {
      const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(180_000)]) : AbortSignal.timeout(180_000);
      const result: ResearchResult = await (options.writer || researchNews)({ url: post.content.source_url!, title: post.content.original_title || post.title, source: post.content.source || '', category: post.content.category || '', sourceText: (post.content.source_text || '').slice(0, 6000) }, signal);
      const article = editorialSchema.parse(result.article);
      if (article.url !== post.content.source_url) throw new Error('조사 결과의 원출처가 일치하지 않습니다.');
      const admins = await authorizedScope(db, viewer);
      if (viewer.role === 'sub-admin' && post.author_id && admins.includes(post.author_id)) throw new Error('관리자 작성 기사는 가공할 수 없습니다.');
      const saved = await db.from('posts').update({ title: article.title, summary: article.summary, tags: article.tags, content: { ...post.content, paragraphs: article.paragraphs, points: article.points, research: result.research, automation: { ...state, status: 'ready', finished_at: new Date().toISOString() } }, updated_at: new Date().toISOString() }).eq('id', post.id).filter('author_id', post.author_id === null ? 'is' : 'eq', post.author_id || 'null').eq('updated_at', claim.data.updated_at).eq('is_published', false).select('id').maybeSingle();
      if (saved.error) throw new Error('작성한 초안을 저장하지 못했습니다.');
      items.push({ id: post.id, title: article.title, status: saved.data ? 'ready' : 'skipped' });
    } catch (cause) {
      const error = cause instanceof Error ? cause.message.slice(0, 500) : '자동 작성에 실패했습니다.';
      const failed = await db.from('posts').update({ content: { ...post.content, automation: { ...state, status: 'failed', finished_at: new Date().toISOString(), retry_after: new Date(Date.now() + 60 * 60_000).toISOString(), error } }, updated_at: new Date().toISOString() }).eq('id', post.id).filter('author_id', post.author_id === null ? 'is' : 'eq', post.author_id || 'null').eq('updated_at', claim.data.updated_at).eq('is_published', false).select('id').maybeSingle();
      if (failed.error) throw new Error('작성 실패 상태를 저장하지 못했습니다.');
      items.push({ id: post.id, title: post.title, status: failed.data ? 'failed' : 'skipped', error });
    }
    options.onProgress?.(items.at(-1)!);
    if (items.at(-1)?.error?.includes('사용량 한도')) break;
  }
  return { written: items.filter(item => item.status === 'ready').length, failed: items.filter(item => item.status === 'failed').length, skipped: items.filter(item => item.status === 'skipped').length, items, remaining: (await newsWritingQueue(db, viewer)).waiting };
}
