// Run: npx tsx scripts/check-pagination.mjs
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PaginationModule from '../app/(dashboard)/components/ContentPagination.tsx';
const ContentPagination = PaginationModule.default || PaginationModule;

const render = (page, totalPages, options = {}) => renderToStaticMarkup(createElement(ContentPagination, {
  page, totalPages, label: '콘텐츠 페이지', href: number => `/dashboard/contents/news?q=design&status=review&page=${number}`, ...options,
}));
const numbers = html => [...html.matchAll(/aria-label="(\d+) 페이지"/g)].map(match => Number(match[1]));
const one = render(1, 1);
assert.equal(one, '', 'Single-page lists have no pagination');
const middle = render(6, 12);
assert.ok(!middle.includes('content-pagination-summary'));
assert.ok(middle.includes('ri-arrow-left-double-line') && middle.includes('ri-arrow-right-double-line'));
assert.ok(middle.includes('ri-arrow-left-s-line') && middle.includes('ri-arrow-right-s-line'));
assert.deepEqual(numbers(middle), [4, 5, 6, 7, 8]);
assert.ok(middle.includes('q=design&amp;status=review&amp;page=7'), 'Filters survive linked navigation');
assert.equal((middle.match(/disabled=""/g) || []).length, 0);
const last = render(12, 12);
assert.deepEqual(numbers(last), [8, 9, 10, 11, 12]);
assert.equal((last.match(/disabled=""/g) || []).length, 2);
assert.deepEqual(numbers(render(999, 3)), [1, 2, 3]);
assert.equal(render(-1, 0), '');
assert.equal(render(NaN, Infinity), '');
const client = render(2, 3, { href: undefined, onPageChange: () => {} });
assert.equal((client.match(/<a /g) || []).length, 0, 'Client lists use the same controls as native buttons');
assert.equal((client.match(/<button /g) || []).length, 7);
assert.equal((client.match(/aria-current="page"/g) || []).length, 1);
console.log('ARCH.B pagination checks passed: shared page window, boundary controls, filters, single/empty pages and link/button variants.');
