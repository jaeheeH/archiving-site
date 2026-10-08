// npx tsx scripts/check-performance.mjs http://localhost:3002 http://localhost:3000
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';
import { newsPage, newsListUrl } from '../lib/news-list.ts';
import { canOptimizeImage } from '../lib/public-image.ts';
import { readOgImage } from '../lib/og-image.ts';
import { optimizeImageUrl } from '../lib/image-optimizer.ts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import EditorialModule from '../app/components/EditorialContent.tsx';
import { extractHeadings } from '../lib/article-outline.ts';

const heading = { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '같은 제목' }] };
const renderImage = '/check.jpg';
const body = { type: 'doc', content: [heading, heading,
  { type: 'columns', attrs: { columns: 3 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '열 본문', marks: [{ type: 'bold' }] }] }] },
  { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colspan: 2 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '표 제목' }] }] }] }] },
  { type: 'imageGallery', attrs: { layout: 'swiper', images: [renderImage, 'javascript:alert(1)'] } },
  { type: 'image', attrs: { src: renderImage, width: -3, height: 'invalid', alt: '작품' } }
] };
const EditorialContent = EditorialModule.default || EditorialModule;
const rendered = renderToStaticMarkup(React.createElement(EditorialContent, { content: body }));
assert.match(rendered, /editorial-columns-three/); assert.match(rendered, /<strong>열 본문<\/strong>/);
assert.match(rendered, /<th colSpan="2"/); assert.match(rendered, /본문 이미지 슬라이더/);
assert.match(rendered, /width="1200" height="800"/); assert.ok(!rendered.includes('javascript:'));
assert.deepEqual(extractHeadings(body).map(h => h.id), ['같은-제목', '같은-제목-2']);

const sample = Array.from({ length: 650 }, (_, i) => ({ id: String(i), title: `공간 ${i}`, category: 'design', source: '매체', tags: ['재료'], description: '설명', collection: 'topic' }));
assert.equal(newsPage(sample, {}).pagination.totalPages, 28);
assert.equal(newsPage(sample, { page: 2 }).articles[0].id, '24');
assert.equal(newsPage(sample, { page: 9999 }).pagination.page, 28);
assert.equal(newsPage(sample, { q: '없는 검색' }).pagination.totalPages, 1);
assert.equal(newsPage(sample, { category: 'development' }).articles.length, 0);
assert.equal(newsPage(sample, { source: '매체', collection: 'topic', q: '공간' }).pagination.total, 650);
assert.equal(new URL(newsListUrl({ page: 2, q: '공간', source: '매체', category: 'design' }), 'http://test').searchParams.get('q'), '공간');
assert.equal(newsListUrl({ page: 1, category: 'all' }), '/news/stories');
for (const url of ['https://localhost/image', 'http://storage.googleapis.com/image', 'https://evilsupabase.co/image', 'https://storage.googleapis.com:8443/image', 'https://user:password@storage.googleapis.com/image']) assert.equal(canOptimizeImage(url), false);
const source = 'https://overgjynkrnwayfammid.supabase.co/storage/v1/object/public/images/a.png?token=keep';
assert.equal(new URL(optimizeImageUrl(source), 'http://test').searchParams.get('url'), source);

const nativeFetch = globalThis.fetch;
const webp = await sharp({ create: { width: 30, height: 20, channels: 3, background: '#178a17' } }).webp().toBuffer();
try {
  globalThis.fetch = async () => new Response(webp, { headers: { 'Content-Type': 'application/octet-stream' } });
  assert.equal((await sharp(await readOgImage('https://storage.googleapis.com/test.webp')).metadata()).format, 'jpeg');
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } });
  await assert.rejects(readOgImage('https://storage.googleapis.com/redirect'), /origin/);
  globalThis.fetch = async () => new Response('not an image');
  await assert.rejects(readOgImage('https://storage.googleapis.com/broken'));
  globalThis.fetch = async () => new Response(new Uint8Array(8 * 1024 * 1024 + 1));
  await assert.rejects(readOgImage('https://storage.googleapis.com/large'), /too large/);
} finally { globalThis.fetch = nativeFetch; }

const base = process.argv[2];
if (base) {
  const fetchPage = path => fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
  const fullResponse = await fetchPage('/api/news');
  const fullText = await fullResponse.text();
  const full = JSON.parse(fullText);
  const listResponse = await fetchPage('/api/news?view=list');
  const listText = await listResponse.text();
  const list = JSON.parse(listText);
  assert.equal(list.pagination.limit, 24);
  assert.equal(list.pagination.total, full.articles.length);
  assert.equal(list.articles.length, Math.min(24, full.articles.length));
  assert.ok(list.articles.every(article => !Object.hasOwn(article, 'paragraphs') && !Object.hasOwn(article, 'points') && !Object.hasOwn(article, 'source_text')));
  const reduction = 1 - Buffer.byteLength(listText) / Buffer.byteLength(fullText);
  assert.ok(reduction >= .7, 'List response must be at least 70% smaller');
  const html = await (await fetchPage('/news/stories')).text();
  assert.equal((html.match(/class="news-story"/g) || []).length, list.articles.length);
  const second = await (await fetchPage('/news/stories?page=2')).text();
  assert.match(second, /rel="canonical" href="[^"]+\/news\/stories\?page=2"/);
  assert.ok(second.includes('에디터의 선택'));
  const scriptBytes = (html, folder) => [...new Set([...html.matchAll(/<script[^>]+src="(\/_next\/static\/[^"?]+)/g)].map(match => match[1]))].reduce((sum, path) => sum + readFileSync(join(folder, path.replace('/_next/', ''))).length, 0);
  const articlePath = '/news/read/news-7533eaa399eb1f1bcc66';
  const articleHtml = await (await fetchPage(articlePath)).text();
  const readerBytes = scriptBytes(articleHtml, process.env.ARCHB_BUILD_DIR || '.next');
  let previousReaderBytes;
  if (process.argv[3]) {
    const previous = await (await fetch(new URL(articlePath, process.argv[3]))).text();
    previousReaderBytes = scriptBytes(previous, '.next');
    assert.ok(readerBytes <= previousReaderBytes * .7, 'Reader JavaScript must be at least 30% smaller');
  }
  for (const slug of ['news-3fc6c28d446192a47f72', 'news-b5cd15cad28fe118ffcb', 'nonexistent-performance-check']) {
    for (const suffix of ['', '&image=0']) {
      const response = await fetchPage(`/api/og?type=article&slug=${slug}${suffix}`);
      assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      const info = await sharp(bytes).metadata();
      assert.equal(info.format, 'png'); assert.equal(info.width, 1200); assert.equal(info.height, 630);
    }
  }
  const fontCss = await (await fetchPage('/fonts/pretendard-v1.3.9/pretendard.css')).text();
  assert.ok(fontCss.includes('font-display: swap') && fontCss.includes('unicode-range:') && !fontCss.includes('url(http'));
  console.log(JSON.stringify({ fullNewsBytes: Buffer.byteLength(fullText), listBytes: Buffer.byteLength(listText), listReductionPercent: Math.round(reduction * 100), readerBytes, previousReaderBytes, gzipListBytes: gzipSync(listText).length }));
}
console.log('Performance checks passed: pagination, image boundaries, WebP decoding, fallback cards and payload budgets.');
