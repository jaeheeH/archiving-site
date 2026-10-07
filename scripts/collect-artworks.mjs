import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../research/art-collection/', import.meta.url));
await mkdir(root, { recursive: true });
const get = async url => {
  const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`${res.status}: ${url}`);
  return res;
};
if (process.argv.includes('--candidates')) {
  const candidates = [];
  for (const id of [436535, 436532, 436524, 437133, 437127, 436105, 437853, 437881, 436965, 436896]) {
    const url = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`;
    try {
      const d = await (await get(url)).json();
      if (d.isPublicDomain && d.primaryImage) candidates.push({
        id: `met-${d.objectID}`, museum: 'The Metropolitan Museum of Art',
        title: d.title, artist: d.artistDisplayName, date: d.objectDate,
        medium: d.medium, dimensions: d.dimensions, culture: d.culture,
        accession: d.accessionNumber, source_url: d.objectURL, api_url: url,
        image_url: d.primaryImage, preview_url: d.primaryImageSmall,
        license: 'CC0', license_evidence: { isPublicDomain: d.isPublicDomain },
        policy_url: 'https://www.metmuseum.org/hubs/open-access',
        raw: d,
      });
    } catch (e) { console.error(e.message); }
  }
  for (const query of ['type=Painting&highlight=1&limit=60', 'type=Print&culture=Japan&limit=15', 'type=Painting&culture=Korea&limit=15']) {
    const url = `https://openaccess-api.clevelandart.org/api/artworks/?cc0&has_image=1&${query}`;
    const result = await (await get(url)).json();
    for (const d of result.data) {
      if (d.share_license_status !== 'CC0' || !d.images?.web?.url) continue;
      if (candidates.some(a => a.id === `cma-${d.id}`)) continue;
      candidates.push({
        id: `cma-${d.id}`, museum: 'The Cleveland Museum of Art',
        title: d.title, artist: d.creators.map(c => c.description).join('; ') || 'Unknown',
        date: d.creation_date, medium: d.technique, dimensions: d.measurements,
        culture: d.culture, accession: d.accession_number, source_url: d.url,
        api_url: `https://openaccess-api.clevelandart.org/api/artworks/${d.id}`,
        image_url: d.images.print?.url || d.images.web.url, preview_url: d.images.web.url,
        license: 'CC0', license_evidence: { share_license_status: d.share_license_status },
        policy_url: 'https://www.clevelandart.org/open-access', raw: d,
      });
    }
  }
  await writeFile(root + 'candidates.json', JSON.stringify(candidates, null, 2));
  console.log(JSON.stringify(candidates.map(({ id, title, artist, date, culture }) => ({ id, title, artist, date, culture })), null, 2));
} else {
  const candidates = JSON.parse(await readFile(root + 'candidates.json', 'utf8'));
  const selected = JSON.parse(await readFile(root + 'selection.json', 'utf8'));
  assert.equal(selected.length, 30);
  assert.equal(new Set(selected.map(a => a.id)).size, 30);
  await mkdir(root + 'images', { recursive: true });
  const manifest = [];
  for (const item of selected) {
    const a = candidates.find(a => a.id === item.id);
    assert(a && a.license === 'CC0' && a.source_url && a.image_url, `Invalid selection: ${item.id}`);
    const bytes = Buffer.from(await (await get(a.image_url)).arrayBuffer());
    assert(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.length > 10000, `Invalid JPEG: ${a.id}`);
    await writeFile(root + `images/${a.id}.jpg`, bytes);
    const { raw, ...record } = a;
    manifest.push({ ...record, ...item, local_image: `images/${a.id}.jpg`, image_bytes: bytes.length, collected_at: new Date().toISOString() });
    console.log(`${manifest.length}/30 ${a.title} (${bytes.length} bytes)`);
  }
  await writeFile(root + 'artworks.json', JSON.stringify(manifest, null, 2));
  console.log('Verified and saved 30 unique CC0 artwork records and JPEG files.');
}
