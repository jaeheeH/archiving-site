import assert from 'node:assert/strict';
import { ART_PAGE_SIZE, artListHref, artListPage, artReturnHref } from '../lib/art-list';

assert.equal(ART_PAGE_SIZE, 24);
assert.deepEqual(artListPage(220, {}), { page: 1, shown: 24, moreHref: '/art?page=2' });
assert.deepEqual(artListPage(220, { page: '2' }), { page: 2, shown: 48, moreHref: '/art?page=3' });
assert.deepEqual(artListPage(220, { page: '10' }), { page: 10, shown: 220, moreHref: null });
assert.deepEqual(artListPage(220, { page: '99999' }), { page: 10, shown: 220, moreHref: null });
for (const total of [0, 8, 24]) assert.equal(artListPage(total, {}).moreHref, null);
for (const page of ['0', '-1', '1.5', '2x', 'Infinity', '9007199254740992']) {
  assert.equal(artListPage(220, { page }).page, 1, page);
}
const filters = { q: '풍경', museum: 'The Cleveland Museum of Art', subject: ['landscape', 'daily-life'] };
const url = new URL(artListPage(80, { ...filters, page: ['2', '3'] }).moreHref!, 'https://example.com');
assert.equal(url.searchParams.get('page'), '3');
assert.equal(url.searchParams.get('q'), filters.q);
assert.equal(url.searchParams.get('museum'), filters.museum);
assert.deepEqual(url.searchParams.getAll('subject'), filters.subject);
assert.equal(artListPage(80, filters).shown, 24, 'A new filter starts at the first batch');
assert.equal(artListHref({}), '/art');
assert.equal(artListHref({ page: '2' }, 2), '/art?page=2');
const returnTo = artListHref({ ...filters, artist: 'claude-monet', period: 'modern', movement: 'impressionism', kind: 'painting' }, 3);
const returnUrl = new URL(returnTo, 'https://example.com');
assert.equal(returnUrl.searchParams.get('page'), '3');
assert.equal(returnUrl.searchParams.get('q'), filters.q);
assert.equal(returnUrl.searchParams.get('museum'), filters.museum);
assert.deepEqual(returnUrl.searchParams.getAll('subject'), filters.subject);
assert.equal(returnUrl.searchParams.get('artist'), 'claude-monet');
assert.equal(returnUrl.searchParams.get('period'), 'modern');
assert.equal(returnUrl.searchParams.get('movement'), 'impressionism');
assert.equal(returnUrl.searchParams.get('kind'), 'painting');
assert.equal(artReturnHref(`${returnTo}#artwork-met-437127`), `${returnTo}#artwork-met-437127`);
assert.equal(artReturnHref('/art'), '/art');
for (const value of [null, '', '//external.example/art', 'https://external.example/art', 'javascript:alert(1)', '/artists', '/artwork', '/art/other', '/art\\external.example']) {
  assert.equal(artReturnHref(value), '/art', 'Only the art list can be a return destination');
}
console.log('Art navigation checks passed: batches, filters, return destinations and invalid input.');
