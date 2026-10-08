// Run: npx tsx scripts/check-seo.mjs http://localhost:3002
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER, PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { XMLParser } from 'fast-xml-parser';
import SeoModule from '../lib/seo.ts';
import EditorialModule from '../app/components/EditorialContent.tsx';
import ConfigModule from '../next.config.ts';
const { pageMetadata, jsonLd, sitePageUrl, isSearchPreview } = SeoModule;
const EditorialContent = EditorialModule.default || EditorialModule;
const configure = ConfigModule.default || ConfigModule;
const nextConfig = configure(PHASE_PRODUCTION_SERVER);
assert.equal(nextConfig.deploymentId, process.env.NEXT_DEPLOYMENT_ID || JSON.parse(readFileSync(new URL(`../${process.env.ARCHB_BUILD_DIR || '.next'}/required-server-files.json`, import.meta.url), 'utf8')).config.deploymentId, 'Runtime must serve the compiled deployment version');
const firstBuild = configure(PHASE_PRODUCTION_BUILD);
assert.ok(firstBuild.deploymentId);
if (!process.env.NEXT_DEPLOYMENT_ID) {
  assert.notEqual(firstBuild.deploymentId, configure(PHASE_PRODUCTION_BUILD).deploymentId, 'Every new build needs a fresh version');
  assert.equal(configure(PHASE_DEVELOPMENT_SERVER).deploymentId, undefined, 'Development keeps native hot reload');
}
const root = new URL(sitePageUrl('/')).origin;
const metadata = pageMetadata({ path: '/art?utm_source=test', title: '작품', description: '설명' });
assert.equal(metadata.alternates.canonical, `${root}/art?utm_source=test`);
assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
assert.equal(pageMetadata({ path: '/art', title: '검색', description: '', noindex: true }).robots.index, false);
const injected = '</script><script>alert(1)</script>';
assert.ok(!jsonLd({ name: injected }).includes('<'));
assert.equal(JSON.parse(jsonLd({ name: injected })).name, injected);
const originalEnv = process.env.VERCEL_ENV;
process.env.VERCEL_ENV = 'preview'; assert.equal(isSearchPreview(), true);
assert.ok((await nextConfig.headers()).some(rule => rule.source === '/:path*' && rule.headers.some(header => header.key === 'X-Robots-Tag' && header.value.includes('noindex'))));
process.env.VERCEL_ENV = 'production'; assert.equal(isSearchPreview(), false);
if (originalEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = originalEnv;
const rendered = renderToStaticMarkup(createElement(EditorialContent, { content: { type: 'doc', content: [
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '본문 제목' }] },
  { type: 'paragraph', content: [{ type: 'text', text: injected, marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
  { type: 'paragraph', content: [{ type: 'text', text: '공식 자료', marks: [{ type: 'link', attrs: { href: 'https://example.com/proof' } }, { type: 'bold' }] }] },
  { type: 'image', attrs: { src: 'javascript:alert(1)' } },
  { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 2 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '표 내용' }] }] }] }] },
] } }));
assert.match(rendered, /<h2>본문 제목<\/h2>/);
assert.ok(!rendered.includes('<script>') && !rendered.includes('javascript:'));
assert.ok(rendered.includes('&lt;script&gt;') && rendered.includes('https://example.com/proof') && rendered.includes('<table>'));

const base = process.argv[2] || 'http://localhost:3002';
const request = (path, bot = 'Yeti') => fetch(new URL(path, base), { headers: { 'User-Agent': bot }, signal: AbortSignal.timeout(30000), redirect: 'manual' });
const page = async path => {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] || '';
  assert.equal((head.match(/rel="canonical"/g) || []).length, 1, `${path}: canonical appears once in the HTML head for Naver`);
  assert.match(head, /name="description" content="[^"<>]+"/);
  assert.match(head, /property="og:url"/);
  assert.ok(!head.includes('content="noindex') || path.includes('?'), `${path}: public content is indexable`);
  assert.equal((html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').match(/<h1\b/g) || []).length, 1, `${path}: one visible H1`);
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(match => {
    const value = JSON.parse(match[1]); return Array.isArray(value) ? value : value['@graph'] || [value];
  });
  return { html, head, schemas };
};
const urls = ['/', '/news/stories', '/news/stories?category=design', '/art', '/artists', '/references', '/gallery', '/privacy', '/terms'];
for (const path of urls) await page(path);
const homeVersion = await page('/');
assert.ok(homeVersion.html.includes(`data-dpl-id="${nextConfig.deploymentId}"`), 'HTML must identify its deployment version');
const assets = [...homeVersion.html.matchAll(/(?:href|src)="(\/_next\/static\/[^"<>]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'));
assert.ok(assets.length && assets.every(path => new URL(path, base).searchParams.get('dpl') === nextConfig.deploymentId), 'CSS and JavaScript must carry the same version');
for (const path of [...new Set(assets)]) assert.equal((await request(path)).status, 200, `Asset exists: ${path}`);
const staleNavigation = await fetch(new URL('/news/stories', base), { headers: { RSC: '1', 'x-deployment-id': 'previous-build' }, redirect: 'manual' });
assert.equal(staleNavigation.headers.get('x-nextjs-deployment-id'), nextConfig.deploymentId, 'A stale client must receive the current version to trigger native full navigation');
for (const path of ['/art?q=test', '/artists?q=test', '/news/stories?q=test', '/references?q=test', '/gallery?search=test']) {
  const { head } = await page(path);
  assert.match(head, /name="robots" content="noindex, follow"/);
}
for (const path of ['/login', '/mypage', '/dashboard', '/auth/callback', '/no-access', '/extension/connect']) {
  const response = await request(path);
  assert.match(response.headers.get('x-robots-tag') || '', /noindex/);
}
for (const path of ['/art/nonexistent-seo-check', '/artists/nonexistent-seo-check', '/gallery/1invalid', '/gallery/999999999', '/news/read/nonexistent-seo-check', '/gallery?page=9999']) assert.equal((await request(path)).status, 404, path);
const parser = new XMLParser();
const sitemapResponse = await request('/sitemap.xml');
assert.equal(sitemapResponse.status, 200);
const entries = parser.parse(await sitemapResponse.text()).urlset.url;
const locs = entries.map(item => item.loc);
assert.equal(new Set(locs).size, locs.length, 'No duplicate sitemap URLs');
assert.ok(locs.every(url => url.startsWith(root) && !/\/(dashboard|mypage|login|blog)(\/|$)/.test(new URL(url).pathname)));
assert.ok(locs.includes(`${root}/gallery`));
const artPath = new URL(locs.find(url => new URL(url).pathname.startsWith('/art/'))).pathname;
const artistPath = new URL(locs.find(url => new URL(url).pathname.startsWith('/artists/'))).pathname;
const galleryPath = new URL(locs.find(url => new URL(url).pathname.startsWith('/gallery/'))).pathname;
assert.ok((await page(artPath)).schemas.some(item => item['@type'] === 'VisualArtwork'));
assert.ok((await page(artistPath)).schemas.some(item => item['@type'] === 'ProfilePage'));
assert.ok((await page(galleryPath)).schemas.some(item => item['@type'] === 'ImageObject'));
const articlePaths = locs.filter(url => new URL(url).pathname.startsWith('/news/read/')).map(url => new URL(url).pathname);
const newsPath = articlePaths.find(path => path.split('/').at(-1).startsWith('news-'));
const editorialPath = articlePaths.find(path => !path.split('/').at(-1).startsWith('news-'));
for (const [path, type] of [[newsPath, 'NewsArticle'], [editorialPath, 'BlogPosting']]) {
  assert.ok(path, `${type}: published sample exists`);
  const { html, schemas } = await page(path);
  const article = schemas.find(item => item['@type'] === type);
  assert.ok(article?.author.name && article.datePublished && article.dateModified && article.publisher['@id']);
  const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  assert.ok((visible.match(/<p\b/g) || []).length > 10, `${type}: body is present before JavaScript`);
  const googleHtml = await (await request(path, 'Googlebot')).text();
  assert.ok(googleHtml.includes('rel="canonical"') && googleHtml.includes(`"@type":"${type}"`));
}
const firstGallery = await page('/gallery');
assert.ok(firstGallery.html.includes('href="/gallery?page=2"'), 'Gallery pagination exposes crawlable links');
const secondGallery = await page('/gallery?page=2');
assert.match(secondGallery.head, /rel="canonical" href="[^"<>]+\/gallery\?page=2"/);
const firstTitles = [...firstGallery.html.matchAll(/class="gallery-image-card[^>]+aria-label="([^"]+)"/g)].map(match => match[1]);
const secondTitles = [...secondGallery.html.matchAll(/class="gallery-image-card[^>]+aria-label="([^"]+)"/g)].map(match => match[1]);
assert.ok(firstTitles.length && secondTitles.length && firstTitles[0] !== secondTitles[0], 'Gallery page 2 has different initial HTML content');
const robots = await (await request('/robots.txt')).text();
assert.ok(robots.includes(`Sitemap: ${root}/sitemap.xml`) && robots.includes('Allow: /api/og') && !robots.includes('Disallow: /\n'));
const rssResponse = await request('/rss.xml');
assert.equal(rssResponse.status, 200);
const items = parser.parse(await rssResponse.text()).rss.channel.item;
assert.ok(Array.isArray(items) && items.every(item => item.link.startsWith(`${root}/news/read/`)));
const legacy = await request(`/blog/${editorialPath.split('/').at(-1)}`);
assert.equal(legacy.status, 308);
assert.equal(legacy.headers.get('location'), editorialPath);
console.log(`ARCH.B SEO passed: ${locs.length} canonical sitemap URLs, Google/Naver HTML, article/body schemas, filters/private noindex, gallery SSR pagination, RSS, redirects and 404s.`);
