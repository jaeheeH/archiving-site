import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { editorialReferences, editorialSchema, editorialText, newsEditSchema } from '../lib/news-editorial.ts';
import { NewsBody } from '../app/news/read/NewsBody.tsx';

const revisions = JSON.parse(fs.readFileSync(new URL('../content/news/review-2026-10-30.json', import.meta.url), 'utf8'));
for (const revision of revisions) {
  const article = editorialSchema.parse(revision.article);
  assert(newsEditSchema.safeParse({ article, is_published: true }).success);
  assert(article.title.length <= 55, 'News headlines state the subject and change directly');
  const sources = editorialReferences(article.url, '원출처 기사', article.paragraphs);
  assert.equal(new Set(sources.map(source => source.url)).size, sources.length);
  assert.equal(sources[0].url, article.url);
  const html = renderToStaticMarkup(createElement(NewsBody, { news: { ...article, original_title: '원출처 기사' } }));
  const body = html.split('<section class="source-credit"')[0];
  let lastPosition = -1;
  for (const section of article.paragraphs) {
    if (section.heading) assert(body.includes(renderToStaticMarkup(createElement('h2', null, section.heading))), 'Related paragraphs share a descriptive heading');
    for (const paragraph of section.paragraphs) {
      const escaped = renderToStaticMarkup(createElement('p', null, paragraph));
      const position = body.indexOf(escaped);
      assert(position > lastPosition, 'All paragraphs remain in editorial order');
      lastPosition = position;
    }
  }
  assert(!body.includes('ARCH.B 분석') && !body.includes('reading-references'));
  assert(!html.includes('href="#news-source-'), 'Sources are collected in the footer only');
  assert(!/ARCH[.\- ]?B(?:는|에서는)|갤러리 설명에 따르면/.test(editorialText(article.paragraphs)), 'Opinion starts with the subject instead of a brand preface');
  for (const source of sources) {
    assert(html.includes(source.url.replaceAll('&', '&amp;')), 'Original source URLs remain reachable');
  }
  assert.equal((html.match(/target="_blank"/g) || []).length, sources.length, 'Each external source appears once');
  assert(html.includes('공식 1차 자료'));
}
const expanded = revisions.find(revision => revision.slug === 'news-fd89251b4b93f481a130').article;
assert(editorialText(expanded.paragraphs).length >= 2600, 'The expanded article develops the background, main argument, recap and opinion');
assert.equal(expanded.paragraphs[0].heading, '', 'The introduction can flow without a heading');
assert.equal(expanded.paragraphs.at(-2).heading, '', 'The recap does not need a generic conclusion heading');
assert.equal(expanded.paragraphs.at(-1).heading, 'ARCH.B 의견');
assert.equal(expanded.paragraphs.at(-1).kind, 'analysis');
assert(!expanded.paragraphs.some(section => ['서론', '본론', '결론'].includes(section.heading)));
const expandedHtml = renderToStaticMarkup(createElement(NewsBody, { news: { ...expanded, original_title: '원출처 기사' } }));
assert(!expandedHtml.includes('<h2></h2>'), 'Blank headings render no empty sections');
assert(expandedHtml.indexOf('<h2>ARCH.B 의견</h2>') < expandedHtml.indexOf('class="source-credit"'));
const longArticle = structuredClone(expanded);
longArticle.paragraphs[0].paragraphs.push('배경과 진행 과정을 근거에 맞춰 설명하는 검증용 문단입니다. '.repeat(28));
assert(editorialText(longArticle.paragraphs).length > 3000);
assert(editorialSchema.safeParse(longArticle).success, 'Detailed articles may exceed the old 3,000-character ceiling');
longArticle.paragraphs[0].paragraphs.push('확인된 내용만 설명하고 추측을 늘리지 않는 검증용 문단입니다. '.repeat(28));
assert(!editorialSchema.safeParse(longArticle).success, 'The overall 4,000-character limit still applies');
const article = { ...revisions[0].article, paragraphs: revisions[0].article.paragraphs.slice(0, 2).concat(revisions[0].article.paragraphs.at(-1)) };
article.paragraphs = article.paragraphs.map(section => ({ ...section, paragraphs: [section.paragraphs.join(' ').repeat(4).slice(0, 450)] }));
assert(editorialText(article.paragraphs).length < 1800 && editorialSchema.safeParse(article).success, 'A complete concise article can be published');
assert(!editorialSchema.safeParse({ ...article, paragraphs: article.paragraphs.slice(0, 2) }).success);
assert(!editorialSchema.safeParse({ ...article, paragraphs: article.paragraphs.map(section => ({ ...section, kind: 'reporting' })) }).success);
assert(!editorialSchema.safeParse({ ...article, paragraphs: article.paragraphs.map(section => ({ ...section, paragraphs: ['이 문단은 너무 짧은 기사만을 만드는 시험용 문단입니다.'] })) }).success);
const repeated = { ...article.paragraphs[0], references: [{ url: article.url, label: '원문 소개', kind: 'reporting' }, { url: article.url, label: '공식 문서', kind: 'primary' }] };
const references = editorialReferences(article.url, '원래 제목', [repeated, repeated]);
assert.equal(references.length, 1);
assert.equal(references[0].kind, 'primary', 'Keep the declared primary-source marker across repeated citations');
assert.equal(references[0].label, '원래 제목', 'The original source keeps its recognizable title');
const legacy = renderToStaticMarkup(createElement(NewsBody, { news: { ...article, original_title: '<script>자료</script>', paragraphs: ['이전 형식의 뉴스 본문을 표시합니다.'] } }));
assert(legacy.includes('이전 형식의 뉴스 본문을 표시합니다.') && legacy.includes('&lt;script&gt;자료&lt;/script&gt;'));
assert(!legacy.includes('<script>자료</script>'));
console.log('News reading checks passed: optional topic headings, background and recap flow, concluding ARCH.B opinion, unique footer sources and legacy rendering.');
