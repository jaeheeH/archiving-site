import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { artistProfileSchema, artistSchema, artworkSchema } from '../lib/art-input';

const editorial = JSON.parse(readFileSync('research/art-collection/editorial.json', 'utf8'));
const works = JSON.parse(readFileSync('research/art-collection/artworks.json', 'utf8'));
const artists = JSON.parse(readFileSync('research/art-collection/artists.json', 'utf8')).artists;
const expansion = JSON.parse(readFileSync('research/art-collection/expansion.json', 'utf8'));
assert.equal(editorial.artworks.length, works.length);
assert.equal(editorial.artists.length, artists.length);
assert.equal(new Set(editorial.artworks.map((row: { id: string }) => row.id)).size, works.length);
assert.equal(new Set(editorial.artists.map((row: { id: string }) => row.id)).size, artists.length);
for (const row of editorial.artists) {
  assert(artists.some((artist: { id: string }) => artist.id === row.id));
  assert(artistProfileSchema.safeParse(row.profile).success, row.id);
  assert(row.profile.description && row.profile.sources.length);
}
for (const row of editorial.artworks) {
  const original = works.find((work: { id: string }) => work.id === row.id);
  assert(original, row.id);
  assert(row.medium_ko && row.dimensions_ko && row.description);
  assert(row.description.length >= 60 && row.description.length <= 1500, row.id);
  // Compare every cm group, including framed, overall and each-panel measurements.
  const cmGroups = (text: string) => [...text.matchAll(/(\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)+)\s*cm/g)].map(match => match[1].replace(/\s*[x×]\s*/g, '×')).sort();
  assert.deepEqual(cmGroups(row.dimensions_ko), cmGroups(original.dimensions), row.id);
  const input = Object.fromEntries(Object.keys(artworkSchema.shape).filter(key => key in original).map(key => [key, original[key]]));
  input.culture = String(input.culture || '');
  const parsed = artworkSchema.safeParse({ ...input, medium_ko: row.medium_ko, dimensions_ko: row.dimensions_ko, description: row.description });
  assert(parsed.success, `${row.id}: ${parsed.error?.message}`);
  assert(artworkSchema.safeParse(input).success, 'older clients can omit translations and introductions');
  assert(!artworkSchema.safeParse({ ...input, description: '가'.repeat(1501) }).success, 'oversized introductions rejected');
}
for (const work of expansion.artworks) {
  const input = Object.fromEntries(Object.keys(artworkSchema.shape).filter(key => key in work).map(key => [key, work[key]]));
  const parsed = artworkSchema.safeParse(input);
  assert(parsed.success, `${work.id}: ${parsed.error?.message}`);
  const cmGroups = (value: string) => [...value.matchAll(/(\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)+)\s*cm/g)].map(match => match[1].replace(/\s*[x×]\s*/g, '×')).sort();
  assert.deepEqual(cmGroups(work.dimensions_ko), cmGroups(work.dimensions), `${work.id}: preserve every cm measurement`);
}
for (const artist of expansion.artists) {
  assert(artistProfileSchema.safeParse(artist.profile).success, artist.id);
  assert(artistSchema.safeParse({ name: artist.name, name_ko: artist.name_ko, source_ids: artist.source_ids, profile: artist.profile }).success, artist.id);
}
const profile = editorial.artists[0].profile;
assert(!artistProfileSchema.safeParse({ ...profile, sources: [] }).success, 'introductions need a source');
for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:secret@example.com']) assert(!artistProfileSchema.safeParse({ ...profile, sources: [{ label: 'Source', url }] }).success, 'unsafe source URL');
assert(!artistProfileSchema.safeParse({ ...profile, description: '가'.repeat(1501) }).success);
assert(!artistProfileSchema.safeParse({ ...profile, private_notes: 'secret' }).success, 'unknown profile keys rejected');
const postId = '0eb2038f-982f-4192-af39-d653908068a3';
assert(!artistProfileSchema.safeParse({ ...profile, related_post_ids: [postId, postId] }).success);
assert(!artistProfileSchema.safeParse({ ...profile, related_post_ids: ['not-a-post'] }).success);
assert(artistSchema.safeParse({ name: 'Artist', name_ko: null, source_ids: [] }).success, 'older clients preserve profiles');
assert.equal(editorial.artists.find((row: { id: string }) => row.id === 'yeoseol').profile.lifespan, '');
assert.equal(editorial.artists.find((row: { id: string }) => row.id === 'yi-taek-gyun').profile.lifespan, '1808–1883년 이후');
assert.equal(editorial.artists.find((row: { id: string }) => row.id === 'kim-si').profile.lifespan, '1524–1593');
console.log(`Art editorial checks passed: ${works.length + expansion.artworks.length} works, ${artists.length + expansion.artists.length} sourced artist introductions, validation and original measurements.`);
