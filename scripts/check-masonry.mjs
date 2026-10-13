import assert from 'node:assert/strict';
import { layoutMasonry } from '../lib/masonry-layout.ts';

// The tall Hokusai print previously left the third column empty.
const heights = [377, 373, 402, 975, 370];
for (const columns of [1, 2, 3, 4]) {
  const result = layoutMasonry(heights, columns, 40);
  assert.equal(new Set(result.positions.map(item => item.column)).size, columns);
  const bottoms = Array(columns).fill(0);
  result.positions.forEach(({ column, top }, index) => {
    assert(top >= bottoms[column]);
    bottoms[column] = top + heights[index] + 40;
  });
  assert.equal(result.height, Math.max(...bottoms) - 40);
}
assert.deepEqual(layoutMasonry(heights, 3, 40).positions.map(item => item.column), [0, 1, 2, 1, 0]);
assert.deepEqual(layoutMasonry([], 3, 40), { positions: [], height: 0 });
assert.deepEqual(layoutMasonry([975], 3, 40), { positions: [{ column: 0, top: 0 }], height: 975 });
console.log('Masonry checks passed: tall artwork, 1/2/3/4 columns, gaps and empty lists.');
