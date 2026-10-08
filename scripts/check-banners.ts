// Run: npx tsx scripts/check-banners.ts
import assert from 'node:assert/strict';
import { DEFAULT_NEWS_BANNER, bannerDate, bannerImage, bannerIsVisible, bannerLink, pickBanner } from '../lib/banners';
import { bannerClickHash } from '../lib/banner-analytics';

assert.equal(bannerImage(DEFAULT_NEWS_BANNER.image_url), DEFAULT_NEWS_BANNER.image_url);
assert.equal(bannerLink('/art?artist=van-gogh'), '/art?artist=van-gogh');
assert.equal(bannerImage('https://example.com/ad.webp'), 'https://example.com/ad.webp');
for (const value of ['javascript:alert(1)', '//example.com', '/\\example.com', 'https://user:pass@example.com', '/art\nunsafe', null]) {
  assert.equal(bannerLink(value), null, `Reject unsafe link: ${value}`);
}
for (const value of ['/api/private', '/banners/../secret.png', '/banners/ad.svg']) assert.equal(bannerImage(value), null);
for (const value of ['2026-02-30', '2026-13-01', 'invalid']) assert.equal(bannerDate(value), null);
assert.equal(bannerDate('2026-10-08'), '2026-10-07T15:00:00.000Z');
assert.equal(bannerDate('2026-10-08', true), '2026-10-08T14:59:59.999Z');

const banner = { ...DEFAULT_NEWS_BANNER, id: 'demo', is_continuous: false,
  start_date: bannerDate('2026-10-08'), end_date: bannerDate('2026-10-08', true) };
const start = Date.parse(banner.start_date!), end = Date.parse(banner.end_date!);
assert.equal(bannerIsVisible(banner, start - 1), false);
assert.equal(bannerIsVisible(banner, start), true);
assert.equal(bannerIsVisible(banner, end), true);
assert.equal(bannerIsVisible(banner, end + 1), false);
assert.equal(bannerIsVisible({ ...banner, is_continuous: true }, end + 1), true);
assert.equal(bannerIsVisible({ ...banner, is_active: false }, start), false);
assert.equal(bannerIsVisible({ ...banner, image_url: 'invalid' }, start), false);
assert.equal(bannerIsVisible({ ...banner, start_date: 'invalid' }, start), false);
assert.equal([{ ...banner, is_active: false }, banner].find(item => bannerIsVisible(item, start))?.id, banner.id);
const choices = [{ ...banner, is_active: false }, banner, { ...banner, id: 'second', kind: 'ad' as const }];
assert.equal(pickBanner(choices, 0, start)?.id, 'demo');
assert.equal(pickBanner(choices, .4999, start)?.id, 'demo');
assert.equal(pickBanner(choices, .5, start)?.id, 'second');
assert.equal(pickBanner(choices, .9999, start)?.id, 'second');
assert.equal(pickBanner(choices, .5, end + 1), null);
assert.equal(pickBanner([], 0), null);
const before = new Date('2026-10-08T14:59:59Z'), after = new Date('2026-10-08T15:00:00Z');
assert.equal(bannerClickHash(null, before, 'secret'), null);
assert.equal(bannerClickHash('invalid', before, 'secret'), null);
assert.notEqual(bannerClickHash('192.0.2.10', before, 'secret'), bannerClickHash('192.0.2.10', after, 'secret'));
assert.notEqual(bannerClickHash('192.0.2.10', before, 'secret'), bannerClickHash('192.0.2.11', before, 'secret'));
assert.equal(bannerClickHash('2001:db8::1', before, 'secret'), bannerClickHash('2001:0db8:0:0:0:0:0:1', before, 'secret'));
console.log('Banner checks passed: URLs, KST periods, equal random selection, hidden/expired exclusions and daily IP hashing.');
