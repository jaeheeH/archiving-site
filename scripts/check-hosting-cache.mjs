// Run against an isolated production build: node scripts/check-hosting-cache.mjs http://localhost:3109 .next-vercel-opt-2026-11-09
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2];
assert.ok(base, 'Provide the production server URL');
const build = process.argv[3] || '.next';
const manifest = JSON.parse(readFileSync(join(build, 'prerender-manifest.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(build, 'required-server-files.json'), 'utf8')).config;
assert.ok(manifest.dynamicRoutes['/news/read/[slug]'], 'Articles must support on-demand ISR');
assert.equal(config.images.minimumCacheTTL, 86400, 'Do not prolong caching of avatars replaced at the same URL');

async function request(path, options) {
  const started = performance.now();
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(60000), ...options });
  const body = await response.text();
  return { response, body, milliseconds: Math.round(performance.now() - started) };
}

const list = await request('/api/news?view=list');
assert.equal(list.response.status, 200);
const article = JSON.parse(list.body).articles[0];
assert.ok(article?.slug, 'A published article is required');
const articlePath = `/news/read/${encodeURIComponent(article.slug)}`;
const first = await request(articlePath);
const cached = await request(articlePath);
assert.equal(first.response.status, 200);
assert.equal(cached.response.status, 200);
assert.equal(cached.response.headers.get('x-nextjs-cache'), 'HIT', 'The second visit must not rerender the article');
assert.match(cached.response.headers.get('cache-control') || '', /s-maxage=3600(?:,|$)/);
assert.ok(cached.body.includes('application/ld+json'), 'Cached articles retain structured metadata');
assert.equal((await request('/news/read/nonexistent-hosting-cache-check')).response.status, 404);

for (const path of ['/art', '/artists']) {
  const page = await request(path);
  assert.equal(page.response.status, 200);
  assert.ok(page.body.includes('(max-width: 1199px) 33vw, (max-width: 1280px) 25vw, 290px'), `${path} images match the four-column list`);
}
const artRoutes = Object.entries(manifest.routes).filter(([path]) => /^\/art\/[^/]+$/.test(path));
assert.ok(artRoutes.length > 0, 'Art detail pages are prerendered');
for (const [path, route] of artRoutes) assert.equal(route.initialRevalidateSeconds, 86400, path);
const artwork = await request(artRoutes[0][0]);
const cachedArtwork = await request(artRoutes[0][0]);
assert.equal(artwork.response.status, 200);
assert.equal(cachedArtwork.response.headers.get('x-nextjs-cache'), 'HIT', 'Artwork revisits reuse ISR');
assert.match(cachedArtwork.response.headers.get('cache-control') || '', /s-maxage=86400(?:,|$)/);

for (const path of ['/news/stories?category=design', '/news/stories?page=2', '/news/stories?q=nonexistent-hosting-cache-check', '/']) {
  const page = await request(path);
  assert.equal(page.response.status, 200, path);
  assert.ok(page.body.includes(path === '/' ? '주요 뉴스' : 'news-list-page'), path);
  if (path !== '/') {
    const expected = JSON.parse((await request(`/api/news?view=list&${path.split('?')[1]}`)).body);
    assert.equal((page.body.match(/class="news-story"/g) || []).length, expected.articles.length, path);
    assert.ok(page.body.includes(`data-analytics-results="${expected.pagination.total}"`), path);
    for (const article of expected.articles) assert.ok(page.body.includes(`href="/news/read/${article.slug}"`), article.slug);
  }
}
console.log(JSON.stringify({ article: articlePath, firstRenderMs: first.milliseconds, cacheHitMs: cached.milliseconds, cacheStatus: cached.response.headers.get('x-nextjs-cache'), artPages: artRoutes.length, artRevalidateSeconds: 86400, imageTtlSeconds: config.images.minimumCacheTTL }));
console.log('Hosting cache checks passed: on-demand article ISR, 404s, art regeneration, responsive images, filters and home.');
