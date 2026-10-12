import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const editorial = read('research/art-collection/editorial.json');
const works = read('research/art-collection/artworks.json');
const artists = read('research/art-collection/artists.json').artists;
const expansion = read('research/art-collection/expansion.json');
const sources = read('research/art-collection/expansion-sources.json').sources;
const references = read('content/references/editorial.json').references;
const allowedCategories = new Set(['UI/UX', '개발', '공간', '디자인', '라이프스타일', '브랜딩', '사진', '전시 & 팝업', '패션']);
assert.equal(new Set(references.map(row => row.id)).size, references.length);
assert.equal(new Set(references.map(row => new URL(row.url).href)).size, references.length, 'Duplicate sites');
for (const reference of references) {
  assert(reference.title.trim() && reference.title.length <= 160);
  assert(reference.description.length >= 40 && reference.description.length <= 500);
  assert(/[가-힣]/.test(reference.description), `Korean introduction: ${reference.title}`);
  assert(reference.range.length > 0 && reference.range.length <= 3);
  assert.equal(new Set(reference.range).size, reference.range.length);
  assert(reference.range.every(category => allowedCategories.has(category)));
  for (const value of [reference.url, reference.source_url]) {
    const url = new URL(value);
    assert.equal(url.protocol, 'https:');
    assert(!url.username && !url.password);
  }
  assert.equal(new URL(reference.url).hostname, new URL(reference.source_url).hostname);
  assert(['official_page', 'official_search_index'].includes(reference.verification));
}
assert.equal(references.find(row => row.id === 10).title, 'Cosmos');
assert.equal(references.find(row => row.id === 10).url, 'https://www.cosmos.so/explore');
for (const work of works) {
  const introduction = editorial.artworks.find(row => row.id === work.id);
  assert(introduction?.description && introduction.description.length <= 1500, work.id);
  assert.equal(new Set(work.artist_ids).size, work.artist_ids.length, work.id);
  assert(work.artist_ids.every(id => artists.some(artist => artist.id === id)), work.id);
  assert.equal(work.artist_status, work.artist_ids.length ? 'identified' : 'unidentified');
}
for (const artist of artists) {
  assert.deepEqual([...artist.artwork_ids].sort(), works.filter(work => work.artist_ids.includes(artist.id)).map(work => work.id).sort(), artist.id);
}
const catalog = [...works, ...expansion.artworks];
assert.equal(new Set(catalog.map(work => work.id)).size, catalog.length, 'Unique artwork IDs');
assert.equal(new Set(catalog.map(work => work.sha256)).size, catalog.length, 'Unique verified images');
assert.equal(expansion.target_per_artist, 5);
assert.deepEqual(expansion.coverage_exceptions.map(row => row.id).sort(), ['kim-si', 'yeoseol', 'yi-taek-gyun']);
for (const artist of artists) {
  const count = catalog.filter(work => work.artist_ids.includes(artist.id)).length;
  if (expansion.coverage_exceptions.some(row => row.id === artist.id)) assert.equal(count, 1, artist.id);
  else assert(count >= expansion.target_per_artist, `${artist.id}: minimum five distinct works`);
}
for (const work of expansion.artworks) {
  const source = sources.find(row => row.id === work.id);
  assert(source, work.id);
  assert.equal(work.artist_ids.length, 1, work.id);
  assert.equal(source.artist_id, work.artist_ids[0], work.id);
  assert(expansion.artist_source_ids[source.artist_id].includes(source.creator_source_id), work.id);
  assert.equal(work.artist_status, 'identified');
  assert(work.description && work.medium_ko && work.dimensions_ko && /[가-힣]/.test(work.title_ko), work.id);
  assert(work.image_width >= 400 && work.image_height >= 400 && work.image_bytes > 10000, work.id);
  if (work.id.startsWith('met-')) {
    assert(source.raw.isPublicDomain && !source.raw.artistPrefix && !source.raw.artistSuffix, work.id);
    assert(source.raw.constituents.some(person => `met:${person.constituentID}` === source.creator_source_id && person.role === 'Artist'), work.id);
    for (const [key, rawKey] of [['title', 'title'], ['date', 'objectDate'], ['medium', 'medium'], ['dimensions', 'dimensions'], ['accession', 'accessionNumber']]) assert.equal(work[key], source.raw[rawKey], work.id);
  } else if (work.id.startsWith('cma-')) {
    assert.equal(source.raw.share_license_status, 'CC0');
    assert(source.raw.creators.some(person => `cma:${person.id}` === source.creator_source_id && !person.qualifier && person.role === 'artist'), work.id);
    assert(!source.raw.cover_accession_number, 'Do not count a panel separately from its complete set');
    for (const [key, rawKey] of [['title', 'title'], ['date', 'creation_date'], ['medium', 'technique'], ['dimensions', 'measurements'], ['accession', 'accession_number']]) assert.equal(work[key], source.raw[rawKey], work.id);
  }
}
assert.equal(expansion.artworks.find(work => work.id === 'bowes-bm-99').license, 'Public Domain (PDM 1.0 · PD-Art)', 'PD-Art must not be relabeled CC0');

if (process.argv.includes('--live')) {
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const results = await Promise.all([
    db.from('artworks').select('id,data'),
    db.from('artists').select('id,profile'),
    db.from('artwork_artists').select('artwork_id,artist_id'),
    db.from('references').select('id,title,description,url,category,range'),
  ]);
  for (const result of results) assert.equal(result.error, null);
  const [liveWorks, liveArtists, links, liveReferences] = results.map(result => result.data);
  for (const original of works) {
    const live = liveWorks.find(row => row.id === original.id)?.data;
    assert(live, original.id);
    assert.equal(live.description, editorial.artworks.find(row => row.id === original.id).description, original.id);
    for (const key of ['title', 'title_ko', 'date', 'medium', 'dimensions', 'source_url', 'license', 'policy_url']) assert.deepEqual(live[key], original[key], `${original.id}: original ${key}`);
    assert.deepEqual(links.filter(link => link.artwork_id === original.id).map(link => link.artist_id).sort(), [...original.artist_ids].sort());
  }
  for (const artist of editorial.artists) assert.deepEqual(liveArtists.find(row => row.id === artist.id)?.profile, artist.profile, artist.id);
  for (const original of expansion.artworks) {
    const live = liveWorks.find(row => row.id === original.id)?.data;
    assert(live, original.id);
    for (const key of Object.keys(original).filter(key => key !== 'artist_ids')) assert.deepEqual(live[key], original[key], `${original.id}: ${key}`);
    assert.deepEqual(links.filter(link => link.artwork_id === original.id).map(link => link.artist_id), original.artist_ids, original.id);
  }
  for (const artist of artists.filter(row => !expansion.coverage_exceptions.some(item => item.id === row.id))) assert(links.filter(link => link.artist_id === artist.id).length >= 5, artist.id);
  for (const reference of references) {
    const live = liveReferences.find(row => row.id === reference.id);
    assert(live, reference.title);
    for (const key of ['title', 'description', 'url', 'range']) assert.deepEqual(live[key], reference[key], `${reference.title}: ${key}`);
    assert.equal(live.category, reference.range[0], reference.title);
  }
}
console.log(`Content quality checks passed: ${catalog.length} works, 16 artists with at least 5 works, 3 documented coverage exceptions, ${references.length} sourced Korean site descriptions${process.argv.includes('--live') ? ' · public database verified' : ''}.`);
