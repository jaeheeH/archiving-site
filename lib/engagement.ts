import { publicPage } from './site-traffic';

export const ANALYTICS_DAYS = [7, 30, 90] as const;
export const analyticsDays = (value: unknown) => [5, ...ANALYTICS_DAYS].includes(Number(value)) ? Number(value) : 7;
export const analyticsId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

export function searchKeyword(value: unknown) {
  if (typeof value !== 'string') return null;
  const text = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
  // Search analytics keep ordinary keywords, never contact details, URLs or credentials.
  return !text || /@|https?:|www\.|\b(?:\d[\s-]?){9,}\b|(?:token|password|secret|비밀번호)\s*[:=]/i.test(text) ? null : text;
}

export function campaign(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value, 'https://www.archbehind.com');
    const clean = (key: string) => {
      const part = url.searchParams.get(key);
      return part && /^[\p{L}\p{N}_. -]{1,64}$/u.test(part) ? part : null;
    };
    return { source: clean('utm_source'), medium: clean('utm_medium') };
  } catch { return null; }
}

export function analyticsTarget(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  if (value.startsWith('/')) return publicPage(value)?.path || null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || /@|%40/i.test(url.pathname) || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':') || !url.hostname.includes('.')) return null;
    return `${url.origin}${url.pathname}`.slice(0, 512);
  } catch { return null; }
}

export function readingDepth(top: number, height: number, viewport: number) {
  return height > 0 ? Math.round(Math.max(0, Math.min(1, (viewport - top) / height)) * 100) : null;
}

// A monotonic active clock: hidden/unfocused tabs and time after 30s idle do not accrue.
export function activeClock(now = 0) {
  let last = now, interaction = now, elapsed = 0;
  return {
    tick(time: number, visible: boolean, active = false) {
      if (visible) elapsed += Math.max(0, Math.min(time, interaction + 30_000) - last);
      last = Math.max(last, time);
      if (active) interaction = time;
      return Math.min(7200, Math.floor(elapsed / 1000));
    },
  };
}

export type ContentMetric = {
  path: string; section: string; title?: string; views: number; visitors: number; tracked: number; measured: number;
  activeSeconds: number | null; depth: number | null; deepReads: number; completions: number;
  saves: number; saveViews: number; likes: number; nextClicks: number; outbound: number; publishedAt?: string | null;
  first7Views?: number; first7Days?: number;
};
export type EngagementStats = {
  since: string | null; returningVisitors: number; previousReturningVisitors: number;
  measured: number; activeSeconds: number | null; depth: number | null; deepReads: number; completions: number;
  saves: number; likes: number; searchCount: number; noResults: number; searchClicks: number; errors: number;
  contents: ContentMetric[];
  keywords: { query: string; section: string; searches: number; noResults: number; clicked: number }[];
  transitions: { from: string; to: string; count: number }[];
  devices: { device: string; measured: number; activeSeconds: number | null; depth: number | null; deepReads: number; errors: number }[];
  errorPages: { path: string; kind: string; count: number }[];
};

export const metricNumber = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value);
export const metricRate = (value: number, total: number) => total ? `${metricNumber(value / total * 100)}%` : '—';
export const metricTime = (seconds: number | null) => seconds === null ? '—' : seconds < 60 ? `${Math.round(seconds)}초` : `${Math.floor(seconds / 60)}분 ${Math.round(seconds % 60)}초`;
