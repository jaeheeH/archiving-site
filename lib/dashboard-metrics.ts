import { CATEGORIES } from './news-feeds';

const DAY = 86_400_000;
const KST = 9 * 3_600_000;

export type MetricPost = {
  id: string; type: string; title: string; slug: string | null;
  is_published: boolean; created_at: string | null; published_at: string | null;
  view_count: number | null; scrap_count: number | null; like_count: number | null;
  category?: string | null; qualityReady?: boolean; qualityReasons?: string[];
};
export type MetricView = { post_id: string; created_at: string | null };
export type MetricMember = { role: string | null; created_at: string | null };

export function kstDate(value: string | Date): string {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time + KST).toISOString().slice(0, 10) : '';
}

export function dashboardPeriod(days: number, now = new Date()) {
  const safeDays = [5, 7, 30].includes(days) ? days : 7;
  const today = kstDate(now);
  const midnight = new Date(`${today}T00:00:00+09:00`).getTime();
  const start = midnight - (safeDays - 1) * DAY;
  return {
    days: safeDays, today, now: now.toISOString(), start: new Date(start).toISOString(),
    previousStart: new Date(start - safeDays * DAY).toISOString(),
    previousEnd: new Date(now.getTime() - safeDays * DAY).toISOString(),
    dates: Array.from({ length: safeDays }, (_, i) => kstDate(new Date(start + i * DAY))),
  };
}

const value = (n: number | null) => Math.max(0, n || 0);
const inRange = (date: string | null, start: string, end: string) => {
  if (!date) return false;
  const time = Date.parse(date);
  return Number.isFinite(time) && time >= Date.parse(start) && time <= Date.parse(end);
};

export function buildDashboardMetrics(posts: MetricPost[], views: MetricView[] | null, members: MetricMember[] | null, days = 7, now = new Date()) {
  const period = dashboardPeriod(days, now);
  const articles = posts.filter(p => ['news', 'blog'].includes(p.type));
  const published = articles.filter(p => p.is_published);
  const articleIds = new Set(published.map(p => p.id));
  // Only retained, published articles in the viewer's scope contribute to reader metrics.
  const scopedViews = views?.filter(v => articleIds.has(v.post_id)) ?? null;
  const count = (rows: { date: string | null }[], previous = false) => rows.filter(r => inRange(r.date, previous ? period.previousStart : period.start, previous ? period.previousEnd : period.now)).length;
  const news = articles.filter(p => p.type === 'news');
  const registrations = news.map(p => ({ date: p.created_at }));
  const publications = published.map(p => ({ date: p.published_at }));
  const viewDates = scopedViews?.map(v => ({ date: v.created_at })) ?? [];
  const daily = period.dates.map(date => ({
    date, registered: registrations.filter(r => r.date && kstDate(r.date) === date && Date.parse(r.date) <= now.getTime()).length,
    published: publications.filter(r => r.date && kstDate(r.date) === date && Date.parse(r.date) <= now.getTime()).length,
    views: scopedViews ? viewDates.filter(r => r.date && kstDate(r.date) === date && Date.parse(r.date) <= now.getTime()).length : null,
  }));
  const periodViews = scopedViews?.filter(v => inRange(v.created_at, period.start, period.now)) ?? [];
  const viewsByPost = new Map<string, number>();
  for (const v of periodViews) viewsByPost.set(v.post_id, (viewsByPost.get(v.post_id) || 0) + 1);
  const hasPeriodViews = periodViews.length > 0;
  const topArticles = published.map(p => ({ ...p, periodViews: viewsByPost.get(p.id) || 0 }))
    .sort((a, b) => (hasPeriodViews ? b.periodViews - a.periodViews : value(b.view_count) - value(a.view_count)) || a.title.localeCompare(b.title));
  const categoryNames: Record<string, string> = CATEGORIES;
  const categories = ['디자인', '개발', '인테리어', '에디토리얼', '기타'].map(label => ({
    label, count: published.filter(p => (p.type === 'blog' ? '에디토리얼' : categoryNames[p.category || ''] || '기타') === label).length,
  }));
  const roleNames: Record<string, string> = { admin: '관리자', 'sub-admin': '부관리자', editor: '에디터', user: '일반 회원' };
  const memberGroups = members ? ['일반 회원', '에디터', '부관리자', '관리자'].map(label => ({ label, count: members.filter(m => (roleNames[m.role || ''] || '일반 회원') === label).length })) : null;
  const draftNews = news.filter(p => !p.is_published);
  const oldDrafts = draftNews.filter(p => p.created_at && Date.parse(p.created_at) < now.getTime() - 7 * DAY).length;
  const qualityIssues = news.filter(p => p.is_published && p.qualityReady === false);
  return {
    period, daily, registered: count(registrations), previousRegistered: count(registrations, true),
    published: count(publications), previousPublished: count(publications, true),
    views: scopedViews ? count(viewDates) : null, previousViews: scopedViews ? count(viewDates, true) : null,
    todayRegistered: daily.at(-1)?.registered || 0, todayPublished: daily.at(-1)?.published || 0,
    pending: draftNews.length, oldDrafts, qualityIssues, categories, memberGroups,
    membersTotal: members?.length ?? null, newMembers: members ? count(members.map(m => ({ date: m.created_at }))) : null,
    publishedTotal: published.length, cumulativeViews: published.reduce((sum, p) => sum + value(p.view_count), 0),
    bookmarks: published.reduce((sum, p) => sum + value(p.scrap_count), 0), likes: published.reduce((sum, p) => sum + value(p.like_count), 0),
    topArticles, hasPeriodViews,
  };
}

export function periodChange(current: number | null, previous: number | null, unit = '건') {
  if (current === null || previous === null) return '기록을 확인할 수 없음';
  if (previous === 0) return current === 0 ? '직전 기간과 동일' : `직전 기간 0 → ${current}${unit}`;
  const change = Math.round((current - previous) / previous * 100);
  return change === 0 ? '직전 기간과 동일' : `직전 기간 대비 ${change > 0 ? '+' : ''}${change}%`;
}
