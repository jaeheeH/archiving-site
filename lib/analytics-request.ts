import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createClient } from './supabase/server';
import { ignoredVisitor } from './site-traffic';

export function rejectedAnalytics(request: NextRequest) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site' || !request.headers.get('content-type')?.startsWith('application/json')) return 403;
  if (ignoredVisitor(request.headers.get('user-agent') || '', request.headers.get('dnt'), request.headers.get('sec-gpc'))) return 204;
  if (['localhost', '127.0.0.1', '[::1]'].includes(request.nextUrl.hostname) && process.env.ARCHB_ANALYTICS_TRACK_LOCALHOST !== 'true') return 204;
  return null;
}

export async function isAnalyticsOperator(request: NextRequest) {
  if (!request.cookies.getAll().some(cookie => /^sb-.+-auth-token/.test(cookie.name))) return false;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return false;
  const profile = await db.from('users').select('role').eq('id', user.id).maybeSingle();
  if (profile.error) throw profile.error;
  return ['admin', 'sub-admin', 'editor'].includes(profile.data?.role || '');
}

export function trafficHash(kind: string, id: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname !== 'overgjynkrnwayfammid.supabase.co') throw new Error('ARCH.B analytics configuration missing');
  return createHmac('sha256', secret).update(`archb-traffic:${kind}:${id}`).digest('hex');
}

export const trafficCookieOptions = (request: NextRequest) => ({ httpOnly: true, sameSite: 'lax' as const, secure: request.nextUrl.protocol === 'https:', path: '/' });
