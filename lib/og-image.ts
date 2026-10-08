import sharp from 'sharp';
import { canOptimizeImage } from './public-image';
export async function readOgImage(src: string) {
  // Each redirect is checked too; an allowed CDN cannot redirect this fetch to a private host.
  let url = src;
  const signal = AbortSignal.timeout(5000);
  for (let redirects = 0; redirects < 4; redirects++) {
    if (!canOptimizeImage(url) || url.startsWith('/')) throw new Error('Unsupported image origin');
    const response = await fetch(url, { signal, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Missing redirect');
      url = new URL(location, url).href;
      continue;
    }
    if (!response.ok || !response.body || Number(response.headers.get('content-length')) > 8 * 1024 * 1024) throw new Error('Image unavailable');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8 * 1024 * 1024) throw new Error('Image too large');
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const jpeg = await sharp(Buffer.concat(chunks), { limitInputPixels: 40_000_000 }).rotate().resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
    return jpeg;
  }
  throw new Error('Too many redirects');
}
