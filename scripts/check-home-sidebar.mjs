import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://localhost:3002';
const response = await fetch(base);
assert.equal(response.status, 200);
const page = await response.text();
assert(page.includes('제안 보내기') && page.includes('메일 앱 열기') && page.includes('주소 복사'));
assert(page.includes('mailto:archbehind@gmail.com?subject=ARCH.B%20%EC%A0%9C%EC%95%88'));
assert(page.includes('aria-label="제안 받을 메일 주소"'));
const discovery = page.match(/<section class="news-archive-discovery"[\s\S]*?<\/section>/)?.[0];
assert(discovery, 'Home shows archive discovery');
assert(page.indexOf(discovery) > page.indexOf('가공 기사는 원출처를'), 'Discovery follows the source note');
const paths = [...new Set([...discovery.matchAll(/href="(\/(?:art|artists)\/[^"?]+)"/g)].map(match => match[1]))];
assert.equal(paths.length, 2, 'One work and one artist');
for (const path of paths) {
  const result = await fetch(new URL(path, base));
  assert.equal(result.status, 200, `Discovery link ${path}`);
}
console.log(`Home sidebar checks passed: suggestion fallback and archive links (${paths.join(', ')}).`);
