import assert from "node:assert/strict";
import fs from "node:fs";
import { FEEDS, parseFeed, canonicalUrl } from "../lib/news-feeds.ts";
import { editorialSchema, editorialBatchSchema, editorialText, newsEditSchema } from "../lib/news-editorial.ts";
import { newsPost, newsSlug, NEWS_FORMAT } from "../lib/news-record.ts";

const seed = JSON.parse(fs.readFileSync(new URL("../content/news/initial-articles.json", import.meta.url), "utf8"));
const researched = JSON.parse(fs.readFileSync(new URL("../content/news/researched-articles.json", import.meta.url), "utf8"));
assert.equal(researched.length, 11, "Every short article needs a reviewable expanded draft");
const articles = seed.map(article => ({ ...article, ...(researched.find(draft => draft.article.url === article.url)?.article || {}) }));
const editorial = ({ url, title, summary, paragraphs, points, tags }) => ({ url, title, summary, paragraphs, points, tags });
editorialBatchSchema.parse({ articles: articles.map(editorial) });
assert.equal(new Set(articles.map(a => newsSlug(a.url))).size, articles.length);
assert.ok(!JSON.stringify(articles).includes("CreativeScope"));
for (const article of articles) {
  const post = newsPost(article);
  assert.equal(post.type, "news");
  assert.equal(post.content.format, NEWS_FORMAT);
  assert.equal(post.is_published, true);
  assert.ok(!("source_text" in post.content));
}
const expanded = articles.find(a => a.url.includes("plat-life"));
assert.ok(editorialText(expanded.paragraphs).length > 2500);
assert.ok(expanded.paragraphs.some(p => p.kind === "analysis"));
assert.ok(expanded.paragraphs.some(p => p.references?.length));
assert.equal(editorialSchema.safeParse({ ...editorial(expanded), paragraphs: ["너무 짧은 본문"] }).success, false);
assert.equal(editorialBatchSchema.safeParse({ articles: [editorial(expanded), editorial(expanded)] }).success, false);
assert.ok(newsEditSchema.safeParse({ article: editorial(expanded), is_published: true }).success);
const incomplete = { ...editorial(expanded), title: "Work in progress", summary: "", paragraphs: [], points: [], tags: [] };
assert.ok(newsEditSchema.safeParse({ article: incomplete, is_published: false }).success, 'Incomplete news must be saveable as a private draft');
assert.equal(newsEditSchema.safeParse({ article: incomplete, is_published: true }).success, false, 'Incomplete drafts must not become public');
assert.equal(newsEditSchema.safeParse({ article: { ...editorial(expanded), author_id: 'another-account' }, is_published: true }).success, false);
assert.equal(newsEditSchema.safeParse({ article: { ...editorial(expanded), paragraphs: [{ heading: '참고자료', kind: 'analysis', paragraphs: ['본문을 작성합니다.'], references: [{ label: '참고 링크', url: 'javascript:alert(1)' }] }] }, is_published: false }).success, false);
assert.equal(canonicalUrl("https://example.com/a?utm_source=test#section", FEEDS[0].url), "https://example.com/a");
const rss = '<rss><channel><item><title>원문 기사</title><link>https://example.com/a?utm_source=test</link><pubDate>Mon, 05 Oct 2026 09:00:00 GMT</pubDate><description><![CDATA[<p>원문 내용</p>]]></description></item></channel></rss>';
const drafts = parseFeed(rss, FEEDS[0], Date.parse("2026-10-06"));
assert.equal(drafts.length, 1);
assert.equal(newsPost(drafts[0]).is_published, false);
assert.equal(newsPost(drafts[0]).content.source_text, "원문 내용");
assert.throws(() => parseFeed('<!DOCTYPE rss [<!ENTITY x "bad">]>' + rss, FEEDS[0]));
const domesticFeed = id => { const feed = FEEDS.find(feed => feed.id === id); assert.ok(feed, `${id} must join collection and scheduled writing`); return feed; };
const domesticRss = (title, categories = []) => `<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><title>${title}</title><link>https://techblog.gccompany.co.kr/article?source=rss----test---4</link><pubDate>Mon, 05 Oct 2026 09:00:00 GMT</pubDate>${categories.map(tag => `<category>${tag}</category>`).join('')}<content:encoded><![CDATA[<p>공식 블로그의 공개된 실무 사례입니다.</p><img src="https://example.com/article.png"/>]]></content:encoded></item></channel></rss>`;
const domesticParse = (id, title, tags) => parseFeed(domesticRss(title, tags), domesticFeed(id), Date.parse('2026-10-07'));
const designDraft = domesticParse('gccompany', '아이콘 시스템을 개선한 경험', ['ux'])[0];
assert.equal(designDraft.category, 'design');
assert.equal(designDraft.description, '공식 블로그의 공개된 실무 사례입니다.');
assert.equal(designDraft.image, 'https://example.com/article.png');
assert.equal(designDraft.url, 'https://techblog.gccompany.co.kr/article');
assert.equal(domesticParse('gccompany', '복날 동료와 식사한 이야기', ['기업문화', '조직문화', '여기어때']).length, 0);
assert.equal(domesticParse('toss', '디자이너가 제품을 개선한 방법')[0].category, 'design');
assert.equal(domesticParse('toss', 'Building a service')[0].category, 'development');
assert.equal(parseFeed(domesticRss('다람쥐 캐릭터를 만든 이야기').replace('공식 블로그의 공개된 실무 사례입니다.', '안녕하세요. Visual Designer입니다.'), domesticFeed('toss'), Date.parse('2026-10-07'))[0].category, 'design', 'Toss RSS has no category tags, so the author introduction must also inform classification');
assert.equal(domesticParse('daangn', '데이터베이스 인덱스를 개선한 방법', ['engineering'])[0].category, 'development');
assert.equal(canonicalUrl('https://example.com/a?source=product', FEEDS[0].url), 'https://example.com/a?source=product', 'Semantic source parameters must be retained');
assert.equal(newsPost(designDraft).is_published, false, 'Domestic articles also require review before publication');

const base = process.argv[2];
if (base) {
  const result = await fetch(new URL("/api/news", base));
  assert.equal(result.status, 200);
  const newsResult = await result.json();
  const published = newsResult.articles;
  assert.ok(FEEDS.every(feed => newsResult.sources.some(source => source.id === feed.id && source.name === feed.name && source.url === feed.url && source.category === feed.category)), 'Configured sources must refresh when the feed list changes, including across server restarts');
  assert.ok(published.length >= articles.length);
  assert.ok(published.filter(a => a.kind === "news").every(a => a.paragraphs?.length && !a.source_text));
  const editorials = published.filter(a => a.kind === "editorial");
  assert.ok(editorials.length > 0, "Existing published blogs must join the article feed");
  assert.ok(editorials.every(a => a.category === "editorial" && a.source === "ARCH.B"));
  for (const article of [published.find(a => a.kind === "news"), editorials[0]]) {
    const status = await fetch(new URL(`/api/posts/by-slug/${article.slug}`, base));
    assert.equal(status.status, 200, 'Bookmark state must load for both news and editorials');
    assert.equal(status.headers.get('cache-control'), 'private, no-store');
    const state = await status.json();
    assert.equal(state.userScraped, false, 'Anonymous readers must not receive another account\'s bookmark state');
    assert.equal(typeof state.scrap_count, 'number');
  }
  const news = published.find(a => a.kind === "news");
  const detail = await (await fetch(new URL(`/api/posts/${news.id}/view`, base))).json();
  assert.ok(detail.author?.id && detail.author.id === detail.author_id, 'News must keep its stored author account');
  if (process.argv[3]) {
    const authors = await Promise.all(published.filter(a => a.kind === 'news').map(async a => {
      const response = await fetch(new URL(`/api/posts/${a.id}/view`, base));
      assert.equal(response.status, 200);
      return (await response.json()).author_id;
    }));
    assert.ok(authors.every(id => id === process.argv[3]), 'Every news article must belong to the requested account');
  }
  const authorHtml = await (await fetch(new URL(`/news/read/${news.slug}`, base))).text();
  assert.ok(!authorHtml.includes('ARCH.B 에디트'), 'News must render its author profile instead of a placeholder');
  if (detail.author.avatar_url) assert.ok(authorHtml.includes(`alt="${detail.author.nickname || detail.author.name}"`), 'The stored author avatar must render');
  assert.equal((await fetch(new URL('/api/posts/by-slug/news-missing', base))).status, 404);
  assert.equal((await fetch(new URL('/api/admin/posts?type=news', base))).status, 401);
  for (const [path, method] of [[`/api/posts/${news.id}`, 'GET'], [`/api/news/${news.id}`, 'PATCH'], [`/api/posts/${news.id}/publish`, 'PATCH']]) {
    assert.equal((await fetch(new URL(path, base), { method })).status, 401, 'News management requires authenticated editor permissions');
  }
  for (const [path, method] of [["/api/news/editorial", "GET"], ["/api/news/editorial", "POST"], ["/api/news/collect", "POST"]]) {
    assert.equal((await fetch(new URL(path, base), { method })).status, 401, path);
  }
  for (const path of ["/", "/news/stories?category=development", `/news/read/${newsSlug(expanded.url)}`, `/news/read/${editorials[0].slug}`]) {
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(html.includes("ARCH.B"), path);
    if (path.startsWith('/news/read/')) {
      assert.ok(html.includes('news-detail-page') && html.includes('news-article-layout'), 'News and editorials must use the same detail layout');
      assert.ok(html.includes('북마크') && html.includes('Written by'));
    }
    if (path === `/news/read/${newsSlug(expanded.url)}`) {
      assert.ok(html.includes('ARCH.B 분석') && html.includes('source-credit') && html.includes('이미지 제공:'));
      const firstParagraph = expanded.paragraphs[0].paragraphs[0];
      assert.ok(html.includes(firstParagraph), 'Processed article body must remain server rendered');
    }
  }
  assert.equal((await fetch(new URL("/news/read/news-missing", base))).status, 404);
  for (const [path, target] of [["/news", "/"], ["/blog", "/news/stories?category=editorial"], [`/blog/${editorials[0].slug}`, `/news/read/${editorials[0].slug}`]]) {
    const response = await fetch(new URL(path, base), { redirect: "manual" });
    assert.equal(response.status, 308, path);
    assert.equal(new URL(response.headers.get("location"), base).pathname + new URL(response.headers.get("location"), base).search, target);
  }
  const rss = await (await fetch(new URL("/rss.xml", base))).text();
  assert.ok(rss.includes(`/news/read/${editorials[0].slug}`));
  assert.ok(!/<link>[^<]*\/blog\//.test(rss));
  const root = await (await fetch(new URL("/", base))).text();
  assert.ok(root.includes("주요 뉴스") && root.includes("에디토리얼") && !root.includes('class="archive-home'));
  assert.ok(!root.includes('news-tools') && !root.includes('id="news-query"'), 'Home must start with stories instead of a duplicate menu and search');
  const list = await (await fetch(new URL("/news/stories?category=development", base))).text();
  assert.ok(list.includes("에디터의 선택") && list.includes("관심 주제") && list.includes("news-list-sidebar"), "Article list must keep its recommendation sidebar when filtered");
  for (const category of ['', 'design', 'development']) {
    const query = '식물';
    const params = new URLSearchParams({ q: query, ...(category ? { category } : {}) });
    const search = await (await fetch(new URL(`/news/stories?${params}`, base))).text();
    const expected = published.filter(a => (!category || a.category === category) && `${a.title} ${a.description} ${a.source} ${a.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())).length;
    assert.equal((search.match(/class="news-story"/g) || []).length, expected, 'Header search and category filters must use the same URL query');
    assert.ok(search.includes('검색 초기화'));
    assert.ok(!search.includes('관심 있는 이야기를 검색하세요'), 'List must not add a second search field');
  }
}
console.log(`ARCH.B news checks passed: ${articles.length} processed articles${base ? ", public routes and editor permissions" : ""}.`);
