import { getSiteSettings } from '@/lib/site-settings';
import { adsenseAdsTxt } from '@/lib/adsense';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await getSiteSettings();
  if (!settings) return new Response('Advertising settings temporarily unavailable.\n', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
  const content = adsenseAdsTxt(settings?.custom_scripts);
  return new Response(content || 'No advertising publishers configured.\n', {
    status: content ? 200 : 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': content ? 'public, max-age=300, s-maxage=3600' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
