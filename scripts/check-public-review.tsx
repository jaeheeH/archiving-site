import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImageConfigContext } from 'next/dist/shared/lib/image-config-context.shared-runtime';
import { imageConfigDefault } from 'next/dist/shared/lib/image-config';
import ArchiveImage from '../app/components/ArchiveImage';
import EditorialContent from '../app/components/EditorialContent';
import { extractHeadings } from '../lib/article-outline';
import { IMAGE_DEVICE_SIZES, IMAGE_SIZES } from '../lib/image-config';

async function main() {
  const cases: [string, () => Promise<void>][] = [
    ['prepared srcset widths match the actual delivered image files', async () => {
      const source = 'https://static-2026.dezeen.com/uploads/2026/10/lebond-norman-foster-watch_dezeen_2364_col_sq3-1024x1024.jpg';
      const imageConfig = { ...imageConfigDefault, deviceSizes: IMAGE_DEVICE_SIZES, imageSizes: IMAGE_SIZES, allSizes: [...IMAGE_SIZES, ...IMAGE_DEVICE_SIZES].sort((a,b) => a-b) };
      const html = renderToStaticMarkup(<ImageConfigContext.Provider value={imageConfig}><ArchiveImage src={source} alt="Watch" width={1200} height={1200} sizes="(max-width: 768px) 100vw, 480px" preload /></ImageConfigContext.Provider>);
      const img = html.match(/<img\b[^>]+>/)![0];
      const srcset = img.match(/srcSet="([^"]+)"/)![1].replaceAll('&amp;', '&');
      const candidates = srcset.split(', ');
      for (const candidate of candidates) {
        const [url, descriptor] = candidate.split(' ');
        const meta = await sharp(await readFile(`public${url}`)).metadata();
        assert.equal(descriptor, `${meta.width}w`, `Incorrect width descriptor for ${url}`);
      }
      assert.equal(new Set(candidates.map(item => item.split(' ')[0])).size, candidates.length, 'Do not repeat one file under multiple widths');
      const preload = html.match(/<link\b[^>]*rel="preload"[^>]*>/)?.[0];
      assert(preload?.includes('as="image"') && preload.includes(`imageSrcSet="${srcset}"`), 'Keep a responsive preload for the cover image');
      assert(!img.includes('loading="lazy"'), 'A preloaded cover must load immediately');
    }],
    ['outline links match server-rendered H1, empty and duplicate headings', async () => {
      const h = (level: number, text: string) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
      const content = { type: 'doc', content: [h(1, 'Intro'), h(2, ''), h(2, 'First section'), h(2, 'Second section'), h(3, 'Third section'), h(2, 'Same'), h(2, 'Same'), h(3, 'Same-2')] };
      const headings = extractHeadings(content);
      assert.deepEqual(headings.map(item => item.text), ['Intro', 'First section', 'Second section', 'Third section', 'Same', 'Same', 'Same-2']);
      const html = renderToStaticMarkup(<EditorialContent content={content} />);
      const rendered = [...html.matchAll(/<h[23]\b([^>]*)>(.*?)<\/h[23]>/g)].filter(match => match[2].trim()).map(match => ({ id: match[1].match(/id="([^"]+)"/)?.[1], text: match[2] }));
      assert.deepEqual(rendered.map(item => item.id), headings.map(item => item.id), 'Links must already point to the right heading before hydration');
      assert.equal(new Set(rendered.map(item => item.id)).size, rendered.length, 'Every anchor must be unique, including explicit numbered headings');
    }],
  ];
  let failures = 0;
  for (const [name, run] of cases) {
    try { await run(); console.log(`PASS: ${name}`); }
    catch (error) { failures++; console.error(`FAIL: ${name}`, error); }
  }
  assert.equal(failures, 0, `${failures} public review regression(s)`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
