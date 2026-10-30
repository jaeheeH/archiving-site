// Validates every review before producing guarded SQL. Does not connect to the DB.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { editorialReferences, editorialSchema, editorialText } from '../lib/news-editorial.ts';

const folder = path.resolve('research/news-backlog-2026-10-30-renewal');
const manifest = JSON.parse(await fs.readFile(path.join(folder, 'manifest.json'), 'utf8'));
const backups = (await Promise.all((await fs.readdir(folder)).filter(file => /^before-\d+\.json$/.test(file)).sort().map(async file => JSON.parse(await fs.readFile(path.join(folder, file), 'utf8'))))).flat();
const beforeById = new Map(backups.map(row => [row.id, row]));
assert.equal(beforeById.size, manifest.length);
const edits = [], report = [];
for (const target of manifest) {
  const before = beforeById.get(target.id);
  const review = JSON.parse(await fs.readFile(path.join(folder, 'reviewed', `${target.id}.json`), 'utf8'));
  assert.equal(review.id, target.id); assert.equal(review.slug, target.slug);
  assert(['existing-published-copy-review', 'direct-editorial-review'].includes(review.method));
  assert.equal(review.before.content_hash, before.content_hash);
  assert.equal(review.before.protected_hash, before.protected_hash);
  const article = editorialSchema.parse(review.article);
  assert.equal(article.url, before.article_content.source_url);
  assert.deepEqual(article.tags, before.tags);
  assert(editorialText(article.paragraphs).length >= (review.method === 'direct-editorial-review' ? 900 : 2400));
  assert.equal(article.paragraphs[0].heading, '');
  assert.equal(article.paragraphs.at(-2).heading, '');
  assert.equal(article.paragraphs.at(-1).heading, 'ARCH.B 의견');
  assert.equal(article.paragraphs.at(-1).kind, 'analysis');
  assert(!/ARCH[.\- ]?B(?:는|에서는)/i.test(editorialText(article.paragraphs)));
  const sources = editorialReferences(article.url, '원출처 기사', before.article_content.paragraphs);
  const actual = editorialReferences(article.url, '원출처 기사', article.paragraphs);
  assert.deepEqual(new Set(actual.map(source => source.url)), new Set(sources.map(source => source.url)));
  for (const source of sources) assert.equal(actual.find(value => value.url === source.url)?.kind, source.kind);
  const afterHash = createHash('sha256').update(JSON.stringify({ title: article.title, summary: article.summary, paragraphs: article.paragraphs, points: article.points })).digest('hex');
  edits.push({ id: review.id, slug: review.slug, before: review.before, article });
  report.push({ id: review.id, slug: review.slug, beforeTitle: before.title, title: article.title, beforeCharacters: editorialText(before.article_content.paragraphs).length, characters: editorialText(article.paragraphs).length, headings: article.paragraphs.map(section => section.heading), sources: actual.length, protectedHash: before.protected_hash, afterHash, method: review.method, checkedAt: review.checkedAt });
}
const protectedHash = "md5(jsonb_build_object('id',id,'slug',slug,'tags',tags,'image',title_image_url,'thumbnail',thumbnail_url,'published',is_published,'published_at',published_at,'author_id',author_id,'other_content',content-'paragraphs'-'points')::text)";
function sqlFor(batch) {
  const payload = JSON.stringify(batch);
  const signature = createHash('sha256').update(payload).digest('hex').slice(0, 20);
  const payloadTag = '$news_' + signature + '$';
  const bodyTag = '$apply_' + signature + '$';
  assert(!payload.includes(payloadTag) && !payload.includes(bodyTag), 'Safe SQL data delimiters');
  return [
    '-- Reviewed public news only; all other data is preserved.',
    'begin;',
    `do ${bodyTag}`,
    'declare item jsonb; affected integer;',
    'begin',
    `  for item in select value from jsonb_array_elements(${payloadTag}${payload}${payloadTag}::jsonb) loop`,
    `    if exists (select 1 from public.posts where id=(item->>'id')::uuid and slug=item->>'slug' and type='news' and is_published=true and title=item->'article'->>'title' and summary=item->'article'->>'summary' and content->'paragraphs'=item->'article'->'paragraphs' and content->'points'=item->'article'->'points' and ${protectedHash}=item->'before'->>'protected_hash') then continue; end if;`,
    "    update public.posts set title=item->'article'->>'title',summary=item->'article'->>'summary',content=jsonb_set(jsonb_set(content,'{paragraphs}',item->'article'->'paragraphs'),'{points}',item->'article'->'points'),updated_at=now()",
    `    where id=(item->>'id')::uuid and slug=item->>'slug' and type='news' and is_published=true and title=item->'before'->>'title' and summary is not distinct from item->'before'->>'summary' and ((item->'before'->>'content_hash' is not null and md5(content::text)=item->'before'->>'content_hash') or (item->'before'->'paragraphs' is not null and content->'paragraphs'=item->'before'->'paragraphs' and content->'points'=item->'before'->'points')) and ${protectedHash}=item->'before'->>'protected_hash';`,
    '    get diagnostics affected = row_count;',
    "    if affected<>1 then raise exception 'News % changed during review; this batch was not applied.',item->>'slug'; end if;",
    '  end loop;',
    `end ${bodyTag};`,
    'commit;',
    '',
  ].join('\n');
}
await fs.mkdir(path.join(folder, 'apply'), { recursive: true });
await fs.mkdir(path.join(folder, 'rollback'), { recursive: true });
const rollback = edits.map(edit => { const old = beforeById.get(edit.id); return { id: edit.id, slug: edit.slug, before: { title: edit.article.title, summary: edit.article.summary, paragraphs: edit.article.paragraphs, points: edit.article.points, protected_hash: edit.before.protected_hash }, article: { url: old.article_content.source_url, title: old.title, summary: old.summary, paragraphs: old.article_content.paragraphs, points: old.article_content.points, tags: old.tags } }; });
for (let start = 0; start < edits.length; start += 2) {
  const name = `${String(start / 2).padStart(3, '0')}.sql`;
  await fs.writeFile(path.join(folder, 'apply', name), sqlFor(edits.slice(start, start + 2)));
  await fs.writeFile(path.join(folder, 'rollback', name), sqlFor(rollback.slice(start, start + 2)));
}
await fs.writeFile(path.join(folder, 'edits.json'), JSON.stringify(edits, null, 2) + '\n');
const summary = { date: '2026-10-30', method: 'Existing published copy was restructured. Earlier model-reviewed drafts and direct editorial revisions are identified per article. No fresh reporting or image additions.', articles: report.length, minimumCharacters: Math.min(...report.map(row => row.characters)), maximumCharacters: Math.max(...report.map(row => row.characters)), averageCharacters: Math.round(report.reduce((sum, row) => sum + row.characters, 0) / report.length), entries: report };
await fs.writeFile('content/news/renewal-2026-10-30.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ validated: report.length, batches: Math.ceil(report.length / 2), minimumCharacters: summary.minimumCharacters, maximumCharacters: summary.maximumCharacters, averageCharacters: summary.averageCharacters }));
