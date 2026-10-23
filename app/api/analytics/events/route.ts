import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyticsId, analyticsTarget, searchKeyword } from '@/lib/engagement';
import { isAnalyticsOperator, rejectedAnalytics, trafficCookieOptions, trafficHash } from '@/lib/analytics-request';

export async function POST(request: NextRequest) {
  const rejected = rejectedAnalytics(request);
  if (rejected) return new NextResponse(null, { status: rejected });
  try {
    if (Number(request.headers.get('content-length')) > 4096) return new NextResponse(null, { status: 413 });
    const text = await request.text();
    if (text.length > 4096) return new NextResponse(null, { status: 413 });
    const input = JSON.parse(text);
    const kinds = ['engagement', 'search', 'search_click', 'navigation', 'outbound', 'save', 'like', 'error'];
    if (!analyticsId(input?.viewId) || !analyticsId(input?.id) || !kinds.includes(input.kind)) return new NextResponse(null, { status: 400 });
    const visitor = request.cookies.get('archb_visitor')?.value;
    if (!analyticsId(visitor)) return new NextResponse(null, { status: 204 });
    const integer = (n: unknown, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;
    if (input.kind === 'engagement' && (!integer(input.activeSeconds, 7200) || (input.depth != null && !integer(input.depth, 100)))) return new NextResponse(null, { status: 400 });
    const query = searchKeyword(input.query);
    if (input.kind === 'search' && (!query || !integer(input.results, 1000000) || !analyticsId(input.searchId))) return new NextResponse(null, { status: 400 });
    if (input.kind === 'search_click' && !analyticsId(input.searchId)) return new NextResponse(null, { status: 400 });
    const target = analyticsTarget(input.target);
    if (['navigation', 'outbound', 'search_click', 'save', 'like'].includes(input.kind) && !target) return new NextResponse(null, { status: 400 });
    if (input.kind === 'navigation' && !target?.startsWith('/')) return new NextResponse(null, { status: 400 });
    if (input.kind === 'outbound' && target?.startsWith('/')) return new NextResponse(null, { status: 400 });
    if (input.kind === 'error' && !['image', 'javascript', 'page'].includes(input.errorKind)) return new NextResponse(null, { status: 400 });
    if (await isAnalyticsOperator(request)) return new NextResponse(null, { status: 204 });
    const { error } = await createAdminClient().rpc('record_site_analytics_event', {
      p_id: input.id, p_view: input.viewId, p_visitor: trafficHash('visitor', visitor), p_kind: input.kind,
      p_active: input.kind === 'engagement' ? input.activeSeconds : null, p_depth: input.kind === 'engagement' ? input.depth ?? null : null,
      p_target: target, p_query: input.kind === 'search' ? query : null,
      p_results: input.kind === 'search' ? input.results : null, p_search: analyticsId(input.searchId) ? input.searchId : null,
      p_error: input.kind === 'error' ? input.errorKind : null,
    });
    if (error) throw error;
    const response = new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    const session = request.cookies.get('archb_visit')?.value;
    if (analyticsId(session)) response.cookies.set('archb_visit', session, { ...trafficCookieOptions(request), maxAge: 30 * 60 });
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) return new NextResponse(null, { status: 400 });
    console.error('Site engagement write failed');
    return new NextResponse(null, { status: 503 });
  }
}
