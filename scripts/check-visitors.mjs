import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { publicPage, referrerHost, visitorDevice, ignoredVisitor } from '../lib/site-traffic.ts';

assert.deepEqual(publicPage('/'), { path: '/', section: '홈', label: '홈' });
assert.equal(publicPage('/news/read/real-article')?.section, '뉴스');
assert.equal(publicPage('/artists/artist-1/')?.path, '/artists/artist-1');
for (const path of ['/dashboard', '/login', '/mypage', '/api/users', '//foreign.test', '/news/stories?secret=1', '/art/1#anchor', '/news/read', '/news/stories/foo', '/art/../login', '/art/%2fprivate', '/gallery/a/b', '/references\\private']) assert.equal(publicPage(path), null, path);
assert.equal(referrerHost('https://www.naver.com/search?private=secret', 'www.archbehind.com'), 'naver.com');
assert.equal(referrerHost('https://archbehind.com/a', 'www.archbehind.com'), null);
assert.equal(referrerHost('javascript:alert(1)', 'archbehind.com'), null);
assert.equal(referrerHost('invalid', 'archbehind.com'), null);
assert.equal(referrerHost('http://192.168.1.3/internal', 'archbehind.com'), null);
assert.equal(referrerHost('https://[2001:db8::1]/', 'archbehind.com'), null);
assert.equal(visitorDevice('Mozilla iPhone Mobile'), 'mobile');
assert.equal(visitorDevice('Mozilla Android'), 'tablet');
assert.equal(visitorDevice('Mozilla Windows'), 'desktop');
assert.equal(visitorDevice('Mozilla Macintosh Safari Mobile'), 'tablet');
assert.equal(ignoredVisitor('Googlebot', null, null), true);
assert.equal(ignoredVisitor('Mozilla', '1', null), true);
assert.equal(ignoredVisitor('Mozilla', null, '1'), true);
assert.equal(ignoredVisitor('Mozilla', null, null), false);

const base = process.argv.find(arg => arg.startsWith('http'));
if (base) {
  const event = { id: randomUUID(), path: '/news/stories', referrer: 'https://www.naver.com/?private=not-stored' };
  const headers = { 'Content-Type': 'application/json', Origin: new URL(base).origin, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) ARCHB-QA' };
  const post = (body, extra = {}) => fetch(new URL('/api/analytics/pageview', base), { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  assert.equal((await post(event, { Origin: 'https://foreign.test' })).status, 403);
  assert.equal((await post({ ...event, path: '/mypage' })).status, 400);
  assert.equal((await post({ ...event, id: 'invalid' })).status, 400);
  assert.equal((await post({ ...event, referrer: 'x'.repeat(5000) })).status, 413);
  for (const extra of [{ DNT: '1' }, { 'Sec-GPC': '1' }, { 'User-Agent': 'Googlebot' }]) {
    const response = await post(event, extra);
    assert.equal(response.status, 204); assert.equal(response.headers.get('set-cookie'), null);
  }
  const anonymous = await fetch(new URL('/dashboard/analytics/visitors', base), { redirect: 'manual' });
  assert.equal(anonymous.status, 307);
  if (process.argv.includes('--live-write')) {
    const { createClient } = await import('@supabase/supabase-js');
    assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, 'overgjynkrnwayfammid.supabase.co');
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const ids = [event.id, randomUUID()];
    let accountId;
    try {
      const first = await post(event);
      assert.equal(first.status, 204);
      const cookies = first.headers.getSetCookie();
      assert.equal(cookies.length, 2);
      assert.ok(cookies.every(cookie => /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie)));
      const cookie = cookies.map(value => value.split(';')[0]).join('; ');
      assert.equal((await post(event, { Cookie: cookie })).status, 204);
      assert.equal((await post({ ...event, id: ids[1], path: '/art' }, { Cookie: cookie })).status, 204);
      const result = await db.from('site_page_views').select('*').in('id', ids).order('created_at');
      assert.equal(result.error, null); assert.equal(result.data.length, 2);
      const [a, b] = result.data;
      assert.equal(a.visitor_hash, b.visitor_hash); assert.equal(a.session_hash, b.session_hash);
      assert.equal(a.is_entry, true); assert.equal(b.is_entry, false);
      assert.equal(a.referrer_host, 'naver.com'); assert.equal(b.referrer_host, null);
      assert.equal(a.device, 'desktop'); assert.equal(b.path, '/art');
      for (const row of result.data) assert.equal(Object.hasOwn(row, 'user_id'), false);
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      assert.ok((await anon.from('site_page_views').select('*')).error, 'Raw analytics are not public');
      assert.ok((await anon.rpc('site_traffic_stats', { p_start: '2026-10-01', p_end: '2026-10-07', p_previous_start: '2026-09-24', p_previous_end: '2026-09-30' })).error, 'Aggregate RPC is service-only');
      const { createServerClient } = await import('@supabase/ssr');
      const email = `archb-visitor-qa-${randomUUID()}@example.com`, password = randomBytes(32).toString('base64url');
      const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(created.error, null); accountId = created.data.user.id;
      let authCookies = [];
      const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => authCookies, setAll: values => { for (const value of values) { authCookies = authCookies.filter(existing => existing.name !== value.name); authCookies.push(value); } } } });
      assert.equal((await auth.auth.signInWithPassword({ email, password })).error, null);
      const authCookie = authCookies.map(value => `${value.name}=${value.value}`).join('; ');
      for (const role of ['user', 'editor', 'sub-admin', 'admin']) {
        const update = await db.from('users').update({ role }).eq('id', accountId); assert.equal(update.error, null);
        const response = await fetch(new URL('/dashboard/analytics/visitors', base), { headers: { Cookie: authCookie }, redirect: 'manual' });
        assert.equal(response.status, ['admin', 'sub-admin'].includes(role) ? 200 : 307, `Visitor analysis scope: ${role}`);
      }
      if (process.argv.includes('--snapshot')) {
        console.log('Validated temporary API records are available for a 30-second UI snapshot; cleanup runs automatically.');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    } finally {
      // Clean only the two IDs generated by this self-check; preserve all visitor records.
      const cleanup = await db.from('site_page_views').delete().in('id', ids);
      assert.equal(cleanup.error, null);
      if (accountId) assert.equal((await db.auth.admin.deleteUser(accountId)).error, null);
    }
  } else {
    const response = await post(event);
    assert.equal(response.status, 204); assert.equal(response.headers.get('set-cookie'), null, 'Loopback traffic is excluded by default');
  }
}
console.log('ARCH.B visitor checks passed: public routes, source minimization, devices, tracking preferences, request validation, access control and visitor/session deduplication.');
