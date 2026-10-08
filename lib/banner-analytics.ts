import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { kstDate } from './dashboard-metrics';

export function bannerClickHash(ip: string | null, date: Date, secret: string) {
  if (!ip || !isIP(ip)) return null;
  const normalized = isIP(ip) === 6 ? new URL(`http://[${ip}]`).hostname.slice(1, -1) : ip;
  return createHmac('sha256', secret).update(`archb-banner-click:${kstDate(date)}:${normalized}`).digest('hex');
}
