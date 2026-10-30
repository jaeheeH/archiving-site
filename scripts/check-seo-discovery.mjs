// Run: node scripts/check-seo-discovery.mjs. Uses mocked Supabase responses only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { createElement } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { resolveSitemap } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data.js';

const articleImage = 'https://blog.developer.adobe.com/en/publish/2026/09/media_1fd1a586959673f63c0300c56659bc74ff143715c.png?format=pjpg&optimize=medium&width=1200';
const galleryImage = 'https://images.example.com/gallery.jpg?fit=contain&label=R&amp;D';

let posts = [], gallery = [], failedTable, queries = [];
const categories = { design: '디자인', development: '개발', interiors: '인테리어', ai: 'AI', technology: '제품·기술', editorial: '에디토리얼' };
const eligible = post => post.is_published && post.published_at && (post.type === 'blog' || post.type === 'news' && post.content?.format === 'archb-news-v1' && Object.hasOwn(categories, post.content.category) && Array.isArray(post.content.paragraphs) && Array.isArray(post.content.points));
const matches = (row, params) => [...params].every(([key, value]) => {
  if (['select', 'order', 'offset', 'limit'].includes(key)) return true;
  if (value === 'not.is.null') return row[key] != null;
  if (value.startsWith('in.')) return value.slice(4, -1).split(',').includes(String(row[key]));
  if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
  if (value.startsWith('neq.')) return String(row[key]) !== value.slice(4);
  throw new Error(`Unexpected filter: ${key}=${value}`);
});
const db = createClient('https://test.supabase.co', 'test-key', { auth: { persistSession: false }, global: { fetch: async input => {
  const url = new URL(typeof input === 'string' ? input : input.url), table = url.pathname.split('/').at(-1);
  assert.ok(url.href.length < 8000, 'UUID batches must stay within HTTP header limits');
  queries.push({ table, select: url.searchParams.get('select') });
  if (table === failedTable) return Response.json({ message: 'Temporary database outage' }, { status: 503 });
  const rows = table === 'posts' ? posts : table === 'published_post_summaries' ? posts.filter(eligible) : table === 'gallery' ? gallery : [];
  let data = rows.filter(row => matches(row, url.searchParams));
  const order = url.searchParams.get('order');
  if (order?.includes('published_at')) data.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
  else if (order?.includes('id')) data.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const offset = Number(url.searchParams.get('offset') || 0);
  data = data.slice(offset, offset + Number(url.searchParams.get('limit') || 10000));
  // PostgREST returns exactly the selected fields, including JSON scalar aliases.
  const columns = url.searchParams.get('select').split(',');
  data = data.map(row => Object.fromEntries(columns.map(key => key.includes(':') ? [key.split(':')[0], row.content?.category] : [key, row[key]])));
  return Response.json(data);
} } });
const mocks = {
  'server-only': {},
  'next/cache': { unstable_cache: fn => fn },
  '@/lib/supabase/public': { createPublicClient: () => db },
  '@/lib/news-feeds': { CATEGORIES: categories },
  '@/lib/gallery-search-data': {}, './gallery-search-data': {}, './search-text': {},
  '@/lib/avatar-url': { normalizeAvatarUrl: value => value }, './banners': {},
  '@/lib/art-catalog': { getArtCatalog: async () => ({ artists: [{ id: 'artist', updated_at: '2026-10-10' }], artworks: [{ id: 'work', preview_url: '/art.jpg?width=600&quality=75', updated_at: '2026-10-10' }] }) },
  'react/jsx-runtime': jsxRuntime,
};
function loadModule(path) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, URL, Date, console, process, require: name => { assert.ok(mocks[name], `Unexpected dependency: ${name}`); return mocks[name]; } });
  return exports;
}
mocks['./site-url'] = mocks['@/lib/site-url'] = loadModule('../lib/site-url.ts');
mocks['@/lib/seo'] = loadModule('../lib/seo.ts');
const { sitePageUrl, jsonLd, breadcrumb } = mocks['@/lib/seo'];
const sitemap = loadModule('../app/sitemap.ts').default;
mocks['@/lib/news-feeds'] = mocks['./news-feeds'] = { CATEGORIES: categories };
const { getBlogRssXml } = loadModule('../lib/rss.ts');
const makePost = index => ({ id: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`, slug: `story-${index}`, title: `제목 ${index} & <자료>`, summary: '요약', type: index % 2 ? 'news' : 'blog', is_published: true, published_at: '2026-10-10T00:00:00Z', updated_at: '2026-10-11T00:00:00Z', title_image_url: articleImage, content: { format: 'archb-news-v1', category: 'design', paragraphs: [], points: [] }, author_id: null, tags: [] });
posts = Array.from({ length: 501 }, (_, index) => makePost(index));
posts.push({ ...makePost(999), is_published: false }, { ...makePost(998), type: 'news', content: { format: 'invalid' } });
gallery = Array.from({ length: 1001 }, (_, index) => ({ id: index + 1, image_url: galleryImage }));
const entries = await sitemap();
assert.equal(entries.filter(entry => entry.url.includes('/news/read/')).length, 501, 'All summary pages are included');
assert.equal(entries.filter(entry => /\/gallery\/\d+$/.test(entry.url)).length, 1001);
assert.equal(new Set(entries.map(entry => entry.url)).size, entries.length);
assert.ok(!entries.some(entry => entry.url.endsWith('/story-999') || entry.url.endsWith('/story-998')));
for (const entry of entries.filter(entry => /\/(art|gallery|news\/read)\//.test(entry.url))) assert.ok(entry.images[0].startsWith('https://'));
assert.equal(entries.find(entry => entry.url.endsWith('/story-0')).lastModified.toISOString(), '2026-10-11T00:00:00.000Z');
assert.ok(queries.every(query => !query.select.split(',').includes('content')), 'Sitemap never fetches article bodies');
const sitemapXml = resolveSitemap(entries);
assert.equal(XMLValidator.validate(sitemapXml), true, 'The installed Next.js serializer must produce valid XML for image URLs with query strings');
const parsedEntries = new XMLParser().parse(sitemapXml).urlset.url;
assert.equal(parsedEntries.length, entries.length);
assert.equal(parsedEntries.find(entry => entry.loc.endsWith('/story-0'))['image:image']['image:loc'], articleImage, 'XML escaping preserves the actual article image URL');
assert.equal(parsedEntries.find(entry => entry.loc.endsWith('/gallery/1'))['image:image']['image:loc'], galleryImage, 'A literal entity-like query value is preserved after XML parsing');
assert.equal(parsedEntries.find(entry => entry.loc.endsWith('/art/work'))['image:image']['image:loc'], sitePageUrl('/art.jpg?width=600&quality=75'));

queries = []; gallery = []; posts = [makePost(0), { ...makePost(1), updated_at: '2026-10-12T00:00:00Z' }, { ...makePost(2), is_published: false }, { ...makePost(3), type: 'news', content: { format: 'invalid' } }];
const parser = new XMLParser();
const feed = parser.parse(await getBlogRssXml()).rss.channel;
assert.equal(feed.item.length, 2); assert.equal(feed.item[0].title, '제목 0 & <자료>');
assert.equal(feed.lastBuildDate, new Date('2026-10-12T00:00:00Z').toUTCString(), 'An older article edit updates the feed modification date');
assert.ok(queries.every(query => !query.select.split(',').includes('content')), 'RSS only fetches scalar news metadata');
failedTable = 'published_post_summaries'; await assert.rejects(getBlogRssXml, error => error.message.includes('outage'));
failedTable = 'posts'; await assert.rejects(sitemap, error => error.message.includes('outage'));
failedTable = undefined;
posts = []; const empty = parser.parse(await getBlogRssXml()).rss.channel; assert.equal(empty.item, undefined);

// Test the shared detail reader: genuine missing content remains 404-capable,
// while outages must propagate as server errors rather than cached missing pages.
const { getBlogPostData } = loadModule('../lib/public-data.ts');
assert.equal(await getBlogPostData('missing'), null);
failedTable = 'posts'; await assert.rejects(() => getBlogPostData('missing'), error => error.message.includes('outage'));
failedTable = 'post_slug_history'; await assert.rejects(() => getBlogPostData('missing'), error => error.message.includes('outage'));
failedTable = undefined;

const pageSource = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/news/read/[slug]/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const pageFunction = pageSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ReadPage');
let articleData = { post: { ...makePost(0), title_image_url: null }, authorProfile: { nickname: 'ARCH-B' }, article: null };
const pageModule = { exports: {} };
const code = ts.transpileModule(pageFunction.getText(pageSource), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(code, { exports: pageModule.exports, require: name => mocks[name], getArticleData: async () => articleData, jsonLd, breadcrumb, sitePageUrl, CATEGORIES: categories, extractHeadings: () => [], getNodeText: () => '', editorialText: paragraphs => paragraphs.join(''), NewsBody: () => null, EditorialContent: () => null, BlogDetailClient: props => createElement('main', null, props.children) });
const readSchema = async () => {
  const html = renderToStaticMarkup(await pageModule.exports.default({ params: Promise.resolve({ slug: 'story-0' }) }));
  return JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])[1];
};
let article = await readSchema(); assert.equal(article.author['@type'], 'Organization'); assert.ok(article.author.url); assert.ok(article.image[0].includes('/api/og?type=article')); assert.equal(article.datePublished, articleData.post.published_at);
articleData.authorProfile = { nickname: '김작가' }; articleData.post.title_image_url = '/photo.jpg';
article = await readSchema(); assert.equal(article.author['@type'], 'Person'); assert.equal(article.image[0], sitePageUrl('/photo.jpg'));
articleData.article = { kind: 'news', category: 'ai', description: '설명', source: '공식 출처', url: 'https://example.com/source', original_title: 'Original title', paragraphs: ['기사 본문'], points: ['핵심 내용'], tags: [] };
article = await readSchema(); assert.equal(article['@type'], 'NewsArticle'); assert.equal(article.citation[0], articleData.article.url);
console.log('SEO discovery checks passed: 501 articles, 1,001 gallery entries, private/invalid exclusions, images, real modification dates, lean queries, outage handling, brand/person authors and image fallback. No live data changed.');
