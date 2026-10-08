export type Banner = {
  id: string; title: string; subtitle: string | null; label: string | null;
  image_url: string; link: string | null; is_continuous: boolean;
  start_date: string | null; end_date: string | null; order_index: number; is_active: boolean; kind: 'ad' | 'link';
};
export const BANNER_COLUMNS = 'id,title,subtitle,label,image_url,link,is_continuous,start_date,end_date,order_index,is_active,kind';
export const DEFAULT_NEWS_BANNER: Omit<Banner, 'id'> = {
  title: '작품으로 넓히는 시선', subtitle: 'ARCH.B 아트 아카이브 둘러보기', label: 'ARCH.B',
  image_url: '/banners/archb-art-banner.webp', link: '/art',
  is_continuous: true, start_date: null, end_date: null, order_index: 0, is_active: true, kind: 'link',
};

export type BannerStats = {
  totals: { impressions: number; clicks: number };
  daily: { date: string; impressions: number; clicks: number }[];
  banners: { id: string; impressions: number; clicks: number }[];
};

export function pickBanner(banners: Banner[], random = Math.random(), now = Date.now()) {
  const eligible = banners.filter(banner => bannerIsVisible(banner, now));
  return eligible[Math.min(eligible.length - 1, Math.max(0, Math.floor(random * eligible.length)))] || null;
}

export function bannerLink(value: unknown) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > 2048 || /[\\\u0000-\u001f]/.test(text)) return null;
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  try {
    const url = new URL(text);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

export function bannerImage(value: unknown) {
  const url = bannerLink(value);
  return url && (!url.startsWith('/') || /^\/banners\/[\w.-]+\.(?:png|jpe?g|webp)$/i.test(url)) ? url : null;
}

export function bannerDate(value: unknown, end = false) {
  if (typeof value !== 'string' || !value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00+09:00`);
    if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10) !== value) return null;
    return new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}+09:00`).toISOString();
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function bannerIsVisible(banner: Banner, now = Date.now()) {
  if (!banner.is_active || !bannerImage(banner.image_url)) return false;
  if (banner.is_continuous) return true;
  return (!banner.start_date || Date.parse(banner.start_date) <= now) && (!banner.end_date || now <= Date.parse(banner.end_date));
}
