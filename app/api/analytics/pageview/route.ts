import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ignoredVisitor, publicPage, referrerHost, referrerPath, visitorDevice } from '@/lib/site-traffic';
import { visitorEnvironment, visitorNetwork } from '@/lib/visitor-request';
import { campaign } from '@/lib/engagement';
import { isAnalyticsOperator, trafficCookieOptions, trafficHash } from '@/lib/analytics-request';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site' || !request.headers.get('content-type')?.startsWith('application/json')) return new NextResponse(null, { status: 403 });
  const agent = request.headers.get('user-agent') || '';
  if (ignoredVisitor(agent, request.headers.get('dnt'), request.headers.get('sec-gpc'))) return new NextResponse(null, { status: 204 });
  try {
    if (Number(request.headers.get('content-length')) > 4096) return new NextResponse(null, { status: 413 });
    const text = await request.text();
    if (text.length > 4096) return new NextResponse(null, { status: 413 });
    const input = JSON.parse(text);
    const page = publicPage(input?.path);
    if (!page || typeof input?.id !== 'string' || !uuid.test(input.id)) return new NextResponse(null, { status: 400 });
    if (['localhost', '127.0.0.1', '[::1]'].includes(request.nextUrl.hostname) && process.env.ARCHB_ANALYTICS_TRACK_LOCALHOST !== 'true') return new NextResponse(null, { status: 204 });
    if (await isAnalyticsOperator(request)) return new NextResponse(null, { status: 204, headers: { 'X-Analytics-Ignored': '1', 'Cache-Control': 'no-store' } });
    const visitorCookie = request.cookies.get('archb_visitor')?.value;
    const sessionCookie = request.cookies.get('archb_visit')?.value;
    const visitor = visitorCookie && uuid.test(visitorCookie) ? visitorCookie : randomUUID();
    const session = sessionCookie && uuid.test(sessionCookie) ? sessionCookie : randomUUID();
    const db = createAdminClient();
    const attribution = campaign(input.campaign);
    const { error } = await db.from('site_page_views').upsert({
      id: input.id, visitor_hash: trafficHash('visitor', visitor), session_hash: trafficHash('session', session),
      path: page.path, section: page.section, device: visitorDevice(agent),
      active_seconds: 0, campaign_source: session !== sessionCookie ? attribution?.source : null, campaign_medium: session !== sessionCookie ? attribution?.medium : null,
      ...visitorEnvironment(agent), ...visitorNetwork(request.headers),
      is_entry: session !== sessionCookie,
      referrer_host: session !== sessionCookie ? referrerHost(input.referrer, new URL(request.url).hostname) : null,
      referrer_path: session !== sessionCookie ? referrerPath(input.referrer, new URL(request.url).hostname) : null,
    }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
    if (session !== sessionCookie) {
      const { error: cleanupError } = await db.from('site_page_views').delete().lt('created_at', new Date(Date.now() - 180 * 86400000).toISOString());
      if (cleanupError) console.error('Visitor analytics retention cleanup failed');
    }
    const response = new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    const options = trafficCookieOptions(request);
    if (visitor !== visitorCookie) response.cookies.set('archb_visitor', visitor, { ...options, maxAge: 30 * 86400 });
    response.cookies.set('archb_visit', session, { ...options, maxAge: 30 * 60 });
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) return new NextResponse(null, { status: 400 });
    console.error('Visitor analytics write failed');
    return new NextResponse(null, { status: 503 });
  }
}
