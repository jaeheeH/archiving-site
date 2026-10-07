export function publicPage(path: unknown): { path: string; section: string; label: string } | null {
  if (typeof path !== 'string' || path.length > 512 || /[?#\\%\s]/.test(path)) return null;
  const clean = path === '/' ? path : path.replace(/\/$/, '');
  if (clean === '/') return { path: clean, section: '홈', label: '홈' };
  const match = clean.match(/^\/(news\/stories|news\/read|blog|art|artists|references|gallery)(?:\/([\p{L}\p{N}_-]+))?$/u);
  if (!match || (match[1] === 'news/stories' && match[2]) || (match[1] === 'news/read' && !match[2])) return null;
  const section = ({ 'news/stories': '뉴스', 'news/read': '뉴스', blog: '뉴스', art: '아트', artists: '작가', references: '참고사이트', gallery: '갤러리' } as Record<string, string>)[match[1]];
  return { path: clean, section, label: match[2] ? `${section} 상세` : section };
}

export function referrerHost(value: unknown, ownHost: string): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) || url.hostname.includes(':')) return null;
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname.replace(/^www\./, '') === ownHost.replace(/^www\./, '') || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return null;
    return url.hostname.replace(/^www\./, '').slice(0, 253);
  } catch { return null; }
}

export function visitorDevice(userAgent: string): 'desktop' | 'mobile' | 'tablet' {
  if (/ipad|tablet|macintosh.*mobile|android(?!.*mobile)/i.test(userAgent)) return 'tablet';
  return /mobile|iphone|ipod/i.test(userAgent) ? 'mobile' : 'desktop';
}

export function ignoredVisitor(userAgent: string, dnt: string | null, gpc: string | null) {
  return dnt === '1' || gpc === '1' || /bot|crawler|spider|headless|preview|facebookexternalhit|curl|wget/i.test(userAgent);
}

export type TrafficStats = {
  visitors: number; sessions: number; pageviews: number;
  previousVisitors: number; previousSessions: number; previousPageviews: number;
  trackingSince: string | null;
  daily: { date: string; visitors: number; sessions: number; pageviews: number }[];
  pages: { path: string; section: string; count: number; visitors: number; title?: string }[];
  referrers: { label: string; count: number }[];
  devices: { label: string; count: number }[];
  sections: { label: string; count: number }[];
};
