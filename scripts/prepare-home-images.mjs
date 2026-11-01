// Run with Node 24: node --experimental-strip-types scripts/prepare-home-images.mjs
// Only creates new files. Source files and database URLs are never overwritten.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { canOptimizeImage } from '../lib/public-image.ts';

const base = process.argv.find(value => value.startsWith('http')) || 'https://www.archbehind.com';
const widths = [160, 320, 640, 1280];
const htmlResponse = await fetch(base);
if (!htmlResponse.ok) throw new Error(`Homepage returned ${htmlResponse.status}`);
const html = await htmlResponse.text();
const sources = new Set();
for (const tag of html.matchAll(/<img\b[^>]*>/g)) {
  const src = tag[0].match(/\bsrc="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
  if (!src) continue;
  const url = new URL(src, base);
  const source = url.pathname === '/_next/image' ? url.searchParams.get('url') : url.origin === new URL(base).origin ? url.pathname : url.href;
  if (source && !/\.(?:svg|ico)(?:\?|$)/i.test(source)) sources.add(source);
}
// Keep the random artwork discovery block varied using a prepared subset.
const catalog = JSON.parse(await readFile('research/art-collection/artworks.json', 'utf8'));
const artists = new Set();
for (const work of catalog) {
  const artist = work.artist_ids?.[0];
  if (artists.size >= 12) break;
  if (artist && !artists.has(artist) && work.preview_url && canOptimizeImage(work.preview_url)) {
    artists.add(artist); sources.add(work.preview_url);
  }
}
await mkdir('public/optimized/home', { recursive: true });
await mkdir('audit/home-originals', { recursive: true });
let previous = { images: {} };
try { previous = JSON.parse(await readFile('research/home-images.json', 'utf8')); } catch {}
const images = { ...previous.images };
const report = [];
for (const source of sources) {
  try {
    if (images[source]) { report.push({ source, cached: true }); continue; }
    let bytes;
    if (source.startsWith('/') && !source.startsWith('//') && !source.includes('..') && !source.startsWith('/api/')) {
      bytes = await readFile(`public${source}`);
    } else {
      if (!canOptimizeImage(source)) throw new Error('Unapproved image origin');
      const response = await fetch(source, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ARCH.B Image Preparation)', Accept: 'image/*' } });
      if (!response.ok) throw new Error(`Source returned ${response.status}`);
      if (Number(response.headers.get('content-length')) > 20 * 1024 * 1024) throw new Error('Source too large');
      const chunks = []; let size = 0;
      for await (const chunk of response.body) { size += chunk.length; if (size > 20 * 1024 * 1024) throw new Error('Source too large'); chunks.push(chunk); }
      bytes = Buffer.concat(chunks);
    }
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
    if ((metadata.pages || 1) > 1) throw new Error('Animation preserved; no still conversion');
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const key = createHash('sha256').update(source + checksum).digest('hex').slice(0, 20);
    await writeFile(`audit/home-originals/${checksum}.${metadata.format}`, bytes);
    const variants = [];
    for (const width of widths) {
      const { data, info } = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toBuffer({ resolveWithObject: true });
      const url = `/optimized/home/${key}-w${width}.webp`;
      // Avoid inflated srcset widths when the source is already small.
      if (!variants.some(item => item.width === info.width)) {
        await writeFile(`public${url}`, data);
        variants.push({ width: info.width, url, bytes: data.length });
      }
    }
    images[source] = { originalSha256: checksum, originalBytes: bytes.length, variants };
    report.push({ source, originalBytes: bytes.length, variants });
    console.log(`Prepared ${source}: ${bytes.length} bytes -> ${variants.map(v => `${v.width}px/${v.bytes}B`).join(', ')}`);
  } catch (error) { report.push({ source, error: error.message }); console.error(`Skipped ${source}: ${error.message}`); }
}
await writeFile('research/home-images.json', JSON.stringify({ version: 1, images }, null, 2) + '\n');
await writeFile('audit/home-image-conversion.json', JSON.stringify({ base, preparedAt: new Date().toISOString(), report }, null, 2) + '\n');
console.log(`Prepared ${Object.keys(images).length} image sources. ${report.filter(item => item.error).length} failed; originals preserved.`);
