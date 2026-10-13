import assert from 'node:assert/strict';
import fs from 'node:fs';

const artworks = [...JSON.parse(fs.readFileSync(new URL('../research/art-collection/artworks.json', import.meta.url), 'utf8')), ...JSON.parse(fs.readFileSync(new URL('../research/art-collection/expansion.json', import.meta.url), 'utf8')).artworks];
const artists = [...JSON.parse(fs.readFileSync(new URL('../research/art-collection/artists.json', import.meta.url), 'utf8')).artists, ...JSON.parse(fs.readFileSync(new URL('../research/art-collection/expansion.json', import.meta.url), 'utf8')).artists];
const editorial = JSON.parse(fs.readFileSync(new URL('../research/art-collection/editorial.json', import.meta.url), 'utf8'));
const references = JSON.parse(fs.readFileSync(new URL('../content/references/editorial.json', import.meta.url), 'utf8')).references;
const base = process.argv[2] || 'http://localhost:3000';
const html = async path => {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, path);
  return response.text();
};
const count = (page, kind) => (page.match(new RegExp(`class="archive-card archive-${kind}-card group"`, 'g')) || []).length;
const sample = artworks.find(a => a.artist_ids.length && artworks.filter(b => b.artist_ids.includes(a.artist_ids[0])).length > 1);
const artist = artists.find(a => a.id === sample.artist_ids[0]);
const params = new URLSearchParams({ q: sample.artist, artist: artist.id, museum: sample.museum });
const filtered = artworks.filter(a => a.artist_ids.includes(artist.id) && a.museum === sample.museum && `${a.title_ko} ${a.title} ${a.artist} ${a.medium}`.toLocaleLowerCase('ko').includes(sample.artist.toLocaleLowerCase('ko')));
assert.equal(count(await html('/art'), 'art'), Math.min(24, artworks.length), 'Initial art list renders only the first batch');
assert.equal(count(await html('/art?page=2'), 'art'), Math.min(48, artworks.length), 'More appends a second batch');
assert.equal(count(await html('/art?page=99999'), 'art'), artworks.length, 'The final batch contains the complete collection');
assert.equal(count(await html(`/art?${params}`), 'art'), filtered.length, 'Artwork search must combine with both filters');
assert.equal(count(await html('/artists'), 'artist'), artists.length);
assert.equal(count(await html(`/artists?q=${encodeURIComponent(artist.name)}`), 'artist'), 1, 'Original artist names must remain searchable');
assert.ok((await html('/artists?q=archb-no-such-artist')).includes('검색 결과가 없습니다.'));
for (const path of [`/art/${sample.id}`, `/artists/${artist.id}`]) {
  const page = await html(path);
  assert.ok(page.includes('archb-archive archive-detail') && page.includes('archive-breadcrumb'), path);
}
const artworkPage = await html(`/art/${sample.id}`);
assert.ok(artworkPage.includes('원출처 보기') && artworkPage.includes('이용 정책') && artworkPage.includes(sample.license));
assert.ok(artworkPage.includes('artwork-introduction') && artworkPage.includes(editorial.artworks.find(work => work.id === sample.id).description), 'Sourced artwork introduction');
const introductionSearch = await html(`/art?q=${encodeURIComponent('신인상주의')}`);
assert.equal(count(introductionSearch, 'art'), 1, 'Search includes artwork introductions');
assert.ok(introductionSearch.includes('/art/met-436532'));
assert.ok((await html(`/search?q=${encodeURIComponent('신인상주의')}&type=artwork`)).includes('/art/met-436532'), 'Unified search includes artwork introductions');
assert.ok((await html('/artists')).includes(editorial.artists.find(row => row.id === artist.id).profile.description), 'Artist cards show existing sourced profiles');
for (const person of artists) {
  assert.equal(count(await html(`/artists/${person.id}`), 'art'), artworks.filter(work => work.artist_ids.includes(person.id)).length, `${person.id}: complete artist collection`);
}
assert.ok((await html('/art/met-437877')).includes('가톨릭 신앙의 알레고리'), 'New artwork detail');
assert.ok((await html('/art/cma-128072')).includes('모리조의 언니 에드마'), 'New batch includes sourced Korean introductions');
assert.equal(count(await html('/art?q=모리조&artist=berthe-morisot'), 'art'), artworks.filter(work => work.artist_ids.includes('berthe-morisot')).length, 'Every Morisot work is searchable in art');
assert.ok((await html('/search?q=모리조&type=artist')).includes('/artists/berthe-morisot'), 'New artist is discoverable in unified search');
assert.equal(count(await html('/art?q=함메르쇼이&artist=vilhelm-hammershoi'), 'art'), artworks.filter(work => work.artist_ids.includes('vilhelm-hammershoi')).length, 'Every Hammershoi work is searchable across museums');
assert.ok((await html('/art/smk-kms3696')).includes('Public Domain (PDM 1.0)'), 'SMK artwork retains its individual reuse declaration');
assert.ok((await html('/search?q=함메르쇼이&type=artist')).includes('/artists/vilhelm-hammershoi'), 'Hammershoi is discoverable in unified search');
const referencePage = await html('/references');
for (const reference of references) assert.ok(referencePage.includes(reference.description) && referencePage.includes(reference.title), reference.title);
assert.ok((await html('/references')).includes('참고사이트'));
console.log(`ARCH.B archive checks passed: ${artworks.length} artworks, ${artists.length} artists, combined search/filters and detail sources.`);
