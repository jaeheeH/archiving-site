import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BANNER_COLUMNS, bannerIsVisible } from '@/lib/banners';
import { bannerClickHash } from '@/lib/banner-analytics';
import { ignoredVisitor } from '@/lib/site-traffic';
import { visitorNetwork } from '@/lib/visitor-request';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const empty = () => new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site' || !request.headers.get('content-type')?.startsWith('application/json')) return new NextResponse(null, { status: 403 });
  if (ignoredVisitor(request.headers.get('user-agent') || '', request.headers.get('dnt'), request.headers.get('sec-gpc'))) return empty();
  try {
    if (Number(request.headers.get('content-length')) > 1024) return new NextResponse(null, { status: 413 });
    const text = await request.text();
    if (text.length > 1024) return new NextResponse(null, { status: 413 });
    const input = JSON.parse(text), { id } = await params;
    if (!uuid.test(id) || typeof input?.id !== 'string' || !uuid.test(input.id) || !['impression', 'click'].includes(input.type) || !['/', '/news/stories'].includes(input.path)) return new NextResponse(null, { status: 400 });
    if (['localhost', '127.0.0.1', '[::1]'].includes(request.nextUrl.hostname) && process.env.ARCHB_ANALYTICS_TRACK_LOCALHOST !== 'true') return empty();
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret || new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname !== 'overgjynkrnwayfammid.supabase.co') throw new Error('ARCH.B banner configuration missing');
    const now = new Date();
    const hash = input.type === 'click' ? bannerClickHash(visitorNetwork(request.headers).ip_address, now, secret) : null;
    if (input.type === 'click' && !hash) return empty();
    const db = createAdminClient();
    const { data: banner, error: readError } = await db.from('banners').select(BANNER_COLUMNS).eq('id', id).maybeSingle();
    if (readError) throw readError;
    if (!banner || !bannerIsVisible(banner, now.getTime())) return empty();
    const { error } = await db.from('banner_events').insert({ id: input.id, banner_id: id, event_type: input.type, path: input.path, ip_hash: hash, created_at: now.toISOString() });
    // Both event retries and simultaneous clicks use database uniqueness, across every server.
    if (error && error.code !== '23505') throw error;
    return empty();
  } catch (error) {
    if (error instanceof SyntaxError) return new NextResponse(null, { status: 400 });
    console.error('Banner analytics write failed');
    return new NextResponse(null, { status: 503 });
  }
}
