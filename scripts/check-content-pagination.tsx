// Run: npx tsx scripts/check-content-pagination.tsx
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ContentPagination from '../app/(dashboard)/components/ContentPagination';

for (const totalPages of [0, 1, NaN]) assert.equal(renderToStaticMarkup(<ContentPagination page={1} totalPages={totalPages} label="목록 페이지" href={n => `?page=${n}`} />), '');
for (const page of [1, 3, 5]) {
  const targets = [1, Math.max(1, page - 1), Math.min(5, page + 1), 5];
  const html = renderToStaticMarkup(<ContentPagination page={page} totalPages={5} label="목록 페이지" href={n => `?q=design&page=${n}`} />);
  assert.ok(!html.includes('content-pagination-summary'));
  assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]), [...(page > 1 ? targets.slice(0, 2) : []), 1, 2, 3, 4, 5, ...(page < 5 ? targets.slice(2) : [])].map(n => `?q=design&amp;page=${n}`));
  assert.equal((html.match(/ disabled=""/g) || []).length, page === 3 ? 0 : 2);
  for (const label of ['처음', '이전', '다음', '마지막']) assert.ok(html.includes(`aria-label="${label} 페이지"`));
  assert.equal((html.match(/double-line/g) || []).length, 2);
  const calls: number[] = [];
  const element = ContentPagination({ page, totalPages: 5, label: '목록 페이지', onPageChange: n => calls.push(n) });
  assert.ok(element);
  const buttons = element.props.children.filter((child: React.ReactElement) => child.type === 'button');
  buttons.forEach((button: React.ReactElement<{ disabled: boolean; onClick: () => void }>) => { if (!button.props.disabled) button.props.onClick(); });
  assert.deepEqual(calls, targets.filter((_, index) => page === 3 || (page === 1 ? index > 1 : index < 2)));
}
console.log('Content pagination passed: first/previous/next/last targets, disabled boundaries, labels, icons and preserved search.');
