// Run against a QA server with VERCEL=1 and ARCHB_ANALYTICS_TRACK_LOCALHOST=true:
// npx tsx --env-file=.env.local scripts/check-banner-events.mjs http://localhost:3002
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const base = process.argv.find(arg => arg.startsWith('http'));
assert.ok(base);
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, 'overgjynkrnwayfammid.supabase.co');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: banners, error } = await db.from('banners').select('*').eq('is_active', true);
assert.equal(error, null);
const banner = banners.find(row => row.is_continuous);
assert.ok(banner, 'Use an existing active banner; never expose a QA banner publicly');
const ids = Array.from({ length: 9 }, randomUUID);
const headers = { 'Content-Type': 'application/json', Origin: new URL(base).origin, 'User-Agent': 'Mozilla/5.0 ARCHB-QA', 'x-vercel-forwarded-for': '192.0.2.111' };
const event = (id, type = 'impression') => ({ id, type, path: '/' });
const post = (body, extra = {}) => fetch(`${base}/api/banners/${banner.id}/events`, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
let accountId, fixtureId;
try {
  assert.equal((await post(event(ids[0]), { Origin: 'https://foreign.test' })).status, 403);
  assert.equal((await post({ ...event(ids[0]), path: '/mypage' })).status, 400);
  assert.equal((await post({ ...event(ids[0]), type: 'unknown' })).status, 400);
  assert.equal((await post({ ...event(ids[0]), extra: 'x'.repeat(1100) })).status, 413);
  for (const extra of [{ DNT: '1' }, { 'Sec-GPC': '1' }, { 'User-Agent': 'Googlebot' }]) assert.equal((await post(event(ids[0]), extra)).status, 204);
  assert.equal((await post(event(ids[8], 'click'), { 'x-vercel-forwarded-for': 'not-an-ip' })).status, 204);
  assert.equal((await db.from('banner_events').select('id').in('id', ids)).data.length, 0);
  assert.equal((await post(event(ids[0]))).status, 204);
  assert.equal((await post(event(ids[0]))).status, 204);
  assert.equal((await post(event(ids[1]))).status, 204);
  const simultaneous = await Promise.all(ids.slice(2, 7).map(id => post(event(id, 'click'))));
  assert.ok(simultaneous.every(response => response.status === 204));
  const records = await db.from('banner_events').select('*').in('id', ids);
  assert.equal(records.error, null);
  assert.equal(records.data.filter(row => row.event_type === 'impression').length, 2);
  assert.equal(records.data.filter(row => row.event_type === 'click').length, 1);
  assert.ok(records.data.every(row => !Object.hasOwn(row, 'ip_address')));
  assert.match(records.data.find(row => row.event_type === 'click').ip_hash, /^[a-f0-9]{64}$/);
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  assert.ok((await anon.from('banner_events').select('*')).error);
  assert.ok((await anon.rpc('banner_stats', { p_start: '2026-10-01', p_end: '2026-10-08' })).error);
  assert.equal((await fetch(`${base}/api/settings/banners`)).status, 401);
  const email = `archb-banner-qa-${randomUUID()}@example.com`, password = randomBytes(32).toString('base64url');
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(created.error, null); accountId = created.data.user.id;
  let cookies = [];
  const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => cookies, setAll: values => { for (const value of values) { cookies = cookies.filter(old => old.name !== value.name); cookies.push(value); } } } });
  assert.equal((await auth.auth.signInWithPassword({ email, password })).error, null);
  const cookie = cookies.map(value => `${value.name}=${value.value}`).join('; ');
  const draft = { title: 'Disposable inactive banner QA', image_url: '/banners/archb-art-banner.webp', link: '/art', kind: 'ad', is_active: false, is_continuous: true };
  const manage = (method, body) => fetch(`${base}/api/settings/banners`, { method, headers: { ...headers, Cookie: cookie }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
  for (const role of ['user', 'editor', 'sub-admin', 'admin']) {
    assert.equal((await db.from('users').update({ role }).eq('id', accountId)).error, null);
    const response = await manage('GET');
    assert.equal(response.status, ['admin', 'sub-admin'].includes(role) ? 200 : 403);
    if (response.status === 403) assert.equal((await manage('POST', draft)).status, 403);
    else {
      const result = await response.json();
      assert.equal(result.stats.daily.length, 30);
      assert.ok(result.stats.banners.find(row => row.id === banner.id).clicks >= 1);
      assert.ok(result.stats.totals.impressions >= 2);
    }
  }
  assert.equal((await manage('POST', { ...draft, kind: 'invalid' })).status, 400);
  assert.equal((await manage('POST', { ...draft, link: 'javascript:alert(1)' })).status, 400);
  const saved = await manage('POST', draft); assert.equal(saved.status, 200);
  fixtureId = (await saved.json()).data.id;
  const changed = await manage('PATCH', { ...draft, id: fixtureId, kind: 'link' });
  assert.equal(changed.status, 200); assert.equal((await changed.json()).data.kind, 'link');
  assert.equal((await manage('DELETE', { id: fixtureId })).status, 200); fixtureId = null;
  console.log('Live banner checks passed: visible events, retries, concurrent IP clicks, privacy filters, manager roles, type changes and private aggregates.');
} finally {
  assert.equal((await db.from('banner_events').delete().in('id', ids)).error, null);
  if (fixtureId) assert.equal((await db.from('banners').delete().eq('id', fixtureId)).error, null);
  if (accountId) assert.equal((await db.auth.admin.deleteUser(accountId)).error, null);
}
