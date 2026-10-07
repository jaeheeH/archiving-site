import assert from 'node:assert/strict';
import fs from 'node:fs';

const artworks = JSON.parse(fs.readFileSync(new URL('../research/art-collection/artworks.json', import.meta.url), 'utf8'));
const { artists } = JSON.parse(fs.readFileSync(new URL('../research/art-collection/artists.json', import.meta.url), 'utf8'));
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
assert.equal(count(await html('/art'), 'art'), artworks.length);
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
assert.ok((await html('/references')).includes('참고사이트'));
console.log(`ARCH.B archive checks passed: ${artworks.length} artworks, ${artists.length} artists, combined search/filters and detail sources.`);
