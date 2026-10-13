import assert from 'node:assert/strict';
import { ART_PAGE_SIZE, artListPage } from '../lib/art-list';

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
console.log('Art load-more checks passed: 24-item batches, last batch, filters and invalid page values.');
