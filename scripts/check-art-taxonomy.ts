import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { artTaxonomySchema, artworkSchema } from '../lib/art-input';
import { artFilterOptions, artTaxonomyTags, hasArtFilters, matchesArtFilters, readArtFilters } from '../lib/art-taxonomy';

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const taxonomy = read('research/art-collection/taxonomy.json').artworks as { id: string; taxonomy: NonNullable<import('../lib/art-catalog').Artwork['taxonomy']> }[];
const originals = [...read('research/art-collection/artworks.json'), ...read('research/art-collection/expansion.json').artworks];
const works = originals.map(work => ({ ...work, taxonomy: taxonomy.find(row => row.id === work.id)?.taxonomy }));
assert.equal(new Set(taxonomy.map(row => row.id)).size, originals.length, 'Every current work has one reviewed classification');
assert.deepEqual(taxonomy.map(row => row.id).sort(), originals.map(work => work.id).sort());
for (const row of taxonomy) {
  assert(artTaxonomySchema.safeParse(row.taxonomy).success, `${row.id}: valid controlled terms, sources and period/movement relationship`);
  assert(row.taxonomy.periods.length && row.taxonomy.kind && row.taxonomy.subjects.length, row.id);
  assert(row.taxonomy.sources.some(source => source.url === originals.find(work => work.id === row.id).source_url), `${row.id}: retain the object source`);
  assert.equal(new Set(row.taxonomy.sources.map(source => source.url)).size, row.taxonomy.sources.length, `${row.id}: unique sources`);
}
const sample = taxonomy.find(row => row.id === 'smk-kms3696')!.taxonomy;
assert(sample.subjects.includes('interior'));
assert.equal(sample.movements.length, 0, 'Do not invent a movement for Hammershoi');
assert.equal(taxonomy.find(row => row.id === 'cma-121188')!.taxonomy.movements.length, 0, 'Early Renoir is not automatically classified as Impressionism');
assert.deepEqual(taxonomy.find(row => row.id === 'cma-135173')!.taxonomy.periods, ['modern', '20th-century'], 'A work dated 1895–1900 is discoverable in both periods');
assert.deepEqual(taxonomy.find(row => row.id === 'cma-153339')!.taxonomy.periods, ['joseon'], 'Korean work is not assigned a Western art period');
assert(!artTaxonomySchema.safeParse({ ...sample, sources: [] }).success);
assert(!artTaxonomySchema.safeParse({ ...sample, subjects: ['landscape', 'landscape'] }).success);
assert(!artTaxonomySchema.safeParse({ ...sample, subjects: ['풍경과 빛'] }).success, 'Free-form duplicate subject names cannot enter the controlled taxonomy');
assert(!artTaxonomySchema.safeParse({ ...sample, periods: ['edo'], movements: ['impressionism'] }).success);
assert(!artTaxonomySchema.safeParse({ ...sample, sources: [{ label: 'Unsafe', url: 'javascript:alert(1)' }] }).success);
assert(!artTaxonomySchema.safeParse({ ...sample, private_notes: 'secret' }).success);
const original = originals[0];
const oldInput = Object.fromEntries(Object.keys(artworkSchema.shape).filter(key => key in original).map(key => [key, original[key]]));
oldInput.culture = String(oldInput.culture || '');
assert(artworkSchema.safeParse(oldInput).success, 'Older clients can omit taxonomy');
assert(artworkSchema.safeParse({ ...oldInput, taxonomy: sample }).success, 'Editor/API input can persist taxonomy');
const parsed = readArtFilters({ q: '  함메르쇼이 ', subject: ['interior', 'landscape', 'interior'], period: ['20th-century', 'modern'] });
assert.equal(parsed.q, '함메르쇼이');
assert.equal(parsed.period, '20th-century');
assert.deepEqual(parsed.subjects, ['interior', 'landscape']);
assert(!hasArtFilters(readArtFilters({})));
assert(hasArtFilters(readArtFilters({ subject: 'interior' })));
const select = (params: Parameters<typeof readArtFilters>[0]) => works.filter(work => matchesArtFilters(work, readArtFilters(params)));
assert.equal(select({ artist: 'vilhelm-hammershoi', subject: 'interior' }).length, 4);
assert.equal(select({ artist: 'vilhelm-hammershoi', subject: ['interior', 'landscape'] }).length, 5, 'Subjects use OR within their group');
assert.equal(select({ artist: 'vilhelm-hammershoi', period: '20th-century', subject: 'landscape' }).length, 0, 'Different groups must match the same work');
assert.equal(select({ period: 'joseon', kind: 'print' }).length, 0);
assert.equal(select({ subject: 'not-a-subject' }).length, 0);
assert(!matchesArtFilters({ artist_ids: [], museum: 'Museum' }, readArtFilters({ kind: 'painting' })), 'Future unclassified works remain safe to read');
assert(!artFilterOptions(works).kinds.includes('sculpture'), 'Do not offer an empty category');
assert(artTaxonomyTags(sample).some(tag => tag.label === '실내'));
const artistTags = artTaxonomyTags(works.filter(work => work.artist_ids.includes('vilhelm-hammershoi')).map(work => work.taxonomy!));
assert(artistTags.some(tag => tag.label === '풍경') && artistTags.some(tag => tag.label === '실내') && artistTags.some(tag => tag.label === '인물'), 'Artist tags aggregate the collection, not just the cover');
assert.equal(new Set(artistTags.map(tag => `${tag.group}-${tag.id}`)).size, artistTags.length);

async function checkPublicPages() {
const base = process.argv.find(arg => arg.startsWith('http'));
if (base) {
  const html = async (path: string) => {
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200, path);
    return response.text();
  };
  const ids = (page: string, kind: string) => [...new Set([...page.matchAll(new RegExp(`href="/${kind}/([^"?]+)"`, 'g'))].map(match => match[1]))].sort();
  const cases = [
    { period: 'modern', movement: 'impressionism', kind: 'painting', subject: 'landscape' },
    { period: 'edo', movement: 'ukiyo-e', kind: 'print', subject: 'landscape' },
    { artist: 'vilhelm-hammershoi', subject: ['interior', 'landscape'] },
    { artist: 'vilhelm-hammershoi', period: '20th-century', subject: 'landscape' },
    { subject: 'not-a-subject' },
  ];
  for (const params of cases) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
    const page = await html(`/art?${query}`);
    assert.deepEqual(ids(page, 'art'), select(params).slice(0, 24).map(work => work.id).sort(), query.toString());
    assert(/<meta name="robots" content="noindex/.test(page), 'Filtered URLs are noindex');
  }
  assert.deepEqual(ids(await html('/artists?period=20th-century&subject=interior'), 'artists'), [...new Set(select({ period: '20th-century', subject: 'interior' }).flatMap(work => work.artist_ids))].sort());
  const artistList = await html('/artists?q=%ED%95%A8%EB%A9%94%EB%A5%B4%EC%87%BC%EC%9D%B4');
  assert(artistList.includes('subject=landscape&amp;artist=vilhelm-hammershoi') && artistList.includes('subject=interior&amp;artist=vilhelm-hammershoi'), 'Artist card shows subjects across the collection');
  assert.equal(ids(await html('/artists?period=20th-century&subject=landscape&q=%ED%95%A8%EB%A9%94%EB%A5%B4%EC%87%BC%EC%9D%B4'), 'artists').length, 0, 'Artist filters must match one work, not different works by the same artist');
  const detail = await html('/art/smk-kms3696');
  assert(detail.includes('작품 분류') && detail.includes('분류 확인 출처') && detail.includes('subject=interior'));
  assert((await html('/artists/vilhelm-hammershoi')).includes('artist=vilhelm-hammershoi&amp;period=20th-century'));
  assert((await html('/search?q=%EB%A6%B0%ED%8C%8C&type=artwork')).includes('/art/met-45392'), 'Taxonomy tags participate in unified search');
}
console.log(`Art taxonomy checks passed: ${works.length} reviewed works, source validation, combined filters, multi-subject selection${base ? ', public pages and unified search' : ''}.`);
}
checkPublicPages().catch(error => { console.error(error); process.exitCode = 1; });
