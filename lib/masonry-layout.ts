export function layoutMasonry(itemHeights: number[], columnCount: number, gap: number) {
  const heights = Array.from({ length: Math.max(1, columnCount) }, () => 0);
  const positions = itemHeights.map(height => {
    const column = heights.reduce((shortest, value, index) => value < heights[shortest] ? index : shortest, 0);
    const top = heights[column];
    heights[column] += height + gap;
    return { column, top };
  });
  return { positions, height: itemHeights.length ? Math.max(...heights) - gap : 0 };
}
