import assert from 'node:assert/strict';
import { adsenseAdsTxt, adsensePublisherIds } from '../lib/adsense.ts';
import { relatedPosts } from '../lib/related-posts.ts';
import { canOptimizeImage } from '../lib/public-image.ts';

const first = 'ca-pub-1234567890123456';
const second = 'ca-pub-9876543210987654';
const scripts = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${first}"></script><ins data-ad-client="${first}"></ins>`;
assert.deepEqual(adsensePublisherIds(scripts), ['pub-1234567890123456']);
assert.equal(adsenseAdsTxt(scripts), 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
assert.equal(adsensePublisherIds(`${scripts} ${second}`).length, 2);
for (const value of [null, '', 'ca-pub-123', 'ca-pub-12345678901234567', 'ca-pub-1234567890123456invalid']) assert.equal(adsenseAdsTxt(value), null);

const current = { id: 'monet', tags: ['모네', ' Impressionism '], category_id: 'art' };
const candidate = (id, values = {}) => ({ id, tags: [], category_id: null, published_at: '2026-10-01', ...values });
const art = candidate('art', { category_id: 'art', summary: '모네의 작품을 읽는 다른 시선' });
const tag = candidate('tag', { tags: ['impressionism', 'IMPRESSIONISM'] });
const specific = candidate('specific', { tags: ['모네', 'impressionism'] });
const unrelated = candidate('ai-chip', { category_id: 'tech', published_at: '2026-11-01' });
assert.deepEqual(relatedPosts(current, [unrelated, art, tag, specific, tag, current]).map(item => item.id), ['specific', 'tag', 'art']);
assert.deepEqual(relatedPosts(current, [unrelated]), [], 'Do not fill recommendations with unrelated recent posts');
assert.deepEqual(relatedPosts(current, [{ ...unrelated, category_id: 'art' }]), [], 'A miscategorized AI article must not be recommended below Monet');
assert.deepEqual(relatedPosts({ id: 'x', tags: [], category_id: null }, [art, unrelated]), [], 'Missing metadata is not evidence of relevance');
assert.deepEqual(relatedPosts({ id: 'x' }, [candidate('news', { content: 'design' })], 'design').map(item => item.id), ['news']);
assert.equal(relatedPosts(current, [candidate('repeat', { tags: ['모네', '모네', '모네'] }), specific])[0].id, 'specific', 'Repeated tags cannot inflate relevance');
assert.equal(canOptimizeImage('https://static-2026.dezeen.com/uploads/photo.jpg'), true);
assert.equal(canOptimizeImage('https://static-2026.dezeen.com.attacker.example/photo.jpg'), false);

const base = process.argv.find(value => value.startsWith('http'));
if (base) {
  const ads = await fetch(new URL('/ads.txt', base));
  assert.equal(ads.status, 200);
  assert.match(ads.headers.get('content-type'), /^text\/plain/);
  assert.match(await ads.text(), /^google\.com, pub-\d{16}, DIRECT, f08c47fec0942fa0\n/);
  const artPage = await fetch(new URL('/art?page=2', base)).then(response => response.text());
  assert.match(artPage, /rel="canonical" href="https:\/\/www\.archbehind\.com\/art\?page=2"/);
  const policy = await fetch(new URL('/privacy', base)).then(response => response.text());
  assert.ok(policy.includes('Google 분석 및 광고 쿠키') && policy.includes('검색어, 결과 수'));
  assert.ok(!policy.includes('계정 정보, 검색어, URL 쿼리나 URL 조각은 저장하지 않습니다'));
  const home = await fetch(base).then(response => response.text());
  assert.ok(!/<script[^>]+src="https:\/\/www\.googletagmanager\.com\/gtag\/js/.test(home), 'GTM owns the configured live GA4 tag');
}
console.log('Monetization checks passed: publisher authorization, relevant recommendations, trusted image origin' + (base ? ', HTTP ads.txt, pagination canonical, privacy and single analytics loader.' : '.'));
