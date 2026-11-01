import assert from 'node:assert/strict';
import sharp from 'sharp';
import { copyImageFamily, uploadImageWithVariants } from '../lib/upload-image';
import { imageUploadForm } from '../lib/image-upload-form';
import { removeGalleryStorageAssets } from '../lib/supabase/gallery-utils';
import { imageAssetPaths } from '../lib/image-variants';
import type { SupabaseClient } from '@supabase/supabase-js';

async function main() {
  const png = await sharp({ create: { width: 1600, height: 800, channels: 3, background: '#456789' } }).png().toBuffer();
  function fixture() {
    const objects = new Map<string, Buffer>(); let failAt = '';
    const storage = {
      createSignedUploadUrl: async (path: string) => ({ data: { path, token: 'test-only' }, error: null }),
      upload: async (path: string, body: Buffer | Blob) => {
        if (path === failAt || objects.has(path)) return { error: { statusCode: objects.has(path) ? '409' : '503', message: 'Test storage failure' } };
        objects.set(path, Buffer.isBuffer(body) ? Buffer.from(body) : Buffer.from(await body.arrayBuffer()));
        return { error: null };
      },
      download: async (path: string) => ({ data: objects.has(path) ? new Blob([new Uint8Array(objects.get(path)!)], { type: path.endsWith('.webp') ? 'image/webp' : 'image/png' }) : null, error: null }),
      remove: async (paths: string[]) => { paths.forEach(path => objects.delete(path)); return { error: null }; },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://overgjynkrnwayfammid.supabase.co/storage/v1/object/public/gallery/${path}` } }),
    };
    return { objects, storage, client: { storage: { from: () => storage } } as unknown as SupabaseClient, fail: (path: string) => { failAt = path; } };
  }
  const cases: [string, () => Promise<void>][] = [
    ['gallery keeps the original and variants still used by its main image', async () => {
      const f = fixture(); const result = await uploadImageWithVariants(f.client, 'gallery', 'owner/source.png', png, 'image/png');
      const thumbnail = result.variants.find(v => v.width === 640)!.url;
      await removeGalleryStorageAssets(f.client, [thumbnail], [result.url]);
      assert(f.objects.has(result.original_path), 'A thumbnail-only change cannot delete the original');
      assert(f.objects.has(result.path), 'A thumbnail-only change cannot delete the live main image');
      await removeGalleryStorageAssets(f.client, [thumbnail, result.url]);
      assert.equal(f.objects.size, 0, 'Explicit deletion removes the whole unused family');
    }],
    ['copying an identical family twice is safe and idempotent', async () => {
      const f = fixture(); const result = await uploadImageWithVariants(f.client, 'posts', 'source.png', png, 'image/png');
      await copyImageFamily(f.client, 'posts', result.path, result.path.replace('source.png', 'destination.png'));
      await copyImageFamily(f.client, 'posts', result.path, result.path.replace('source.png', 'destination.png'));
      assert.equal(f.objects.size, 10);
      assert(f.objects.get('destination.png')!.equals(png));
    }],
    ['failed family copies remove only newly created destinations and can retry', async () => {
      const f = fixture(); const result = await uploadImageWithVariants(f.client, 'posts', 'source.png', png, 'image/png');
      f.fail('destination.png.archb-v1-w640.webp');
      await assert.rejects(copyImageFamily(f.client, 'posts', result.path, result.path.replace('source.png', 'destination.png')));
      assert.equal(f.objects.size, 5, 'Do not leave a partial destination that blocks retries');
      f.fail('');
      await copyImageFamily(f.client, 'posts', result.path, result.path.replace('source.png', 'destination.png'));
      assert.equal(f.objects.size, 10);
    }],
    ['copy collisions preserve different existing originals', async () => {
      const f = fixture(); const result = await uploadImageWithVariants(f.client, 'posts', 'source.png', png, 'image/png');
      const existing = Buffer.from('another original'); f.objects.set('destination.png', existing);
      await assert.rejects(copyImageFamily(f.client, 'posts', result.path, result.path.replace('source.png', 'destination.png')));
      assert(f.objects.get('destination.png')!.equals(existing)); assert(f.objects.get('source.png')!.equals(png));
    }],
    ['successful permanent uploads clean their redundant direct-upload source', async () => {
      const f = fixture(); const stagingPath = 'direct/owner/12345678-abcd-1234-abcd-123456789012.png';
      f.objects.set(stagingPath, png);
      const result = await uploadImageWithVariants(f.client, 'posts', 'permanent.png', png, 'image/png', { stagingPath });
      assert(!f.objects.has(stagingPath), 'Explicit content deletion must not leave an untracked public original');
      assert(f.objects.get(result.original_path)!.equals(png));
    }],
    ['failed permanent uploads retain their direct-upload original', async () => {
      const f = fixture(); const stagingPath = 'direct/owner/12345678-abcd-1234-abcd-123456789012.png';
      f.objects.set(stagingPath, png); f.fail('permanent.png.archb-v1-w640.webp');
      await assert.rejects(uploadImageWithVariants(f.client, 'posts', 'permanent.png', png, 'image/png', { stagingPath }));
      assert(f.objects.get(stagingPath)!.equals(png));
    }],
    ['brand originals retain the advertised 12MB limit while posts stay at 8MB', async () => {
      const f = fixture();
      const request = (size: number) => new Request('https://test.local/api/brands/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'prepare', type: 'image/png', size }) });
      const brand = await imageUploadForm(request(10 * 1024 * 1024), f.client, 'brand-assets', 'owner');
      assert(brand instanceof Response); assert.equal(brand.status, 200);
      const post = await imageUploadForm(request(10 * 1024 * 1024), f.client, 'posts', 'owner');
      assert(post instanceof Response); assert.equal(post.status, 400);
      const tooLarge = await imageUploadForm(request(13 * 1024 * 1024), f.client, 'brand-assets', 'owner');
      assert(tooLarge instanceof Response); assert.equal(tooLarge.status, 400);
    }],
  ];
  let failures = 0;
  for (const [name, run] of cases.filter(([name]) => !process.argv[2] || name.includes(process.argv[2]))) {
    try { await run(); console.log(`PASS: ${name}`); }
    catch (error) { failures++; console.error(`FAIL: ${name}`, error); }
  }
  assert.equal(imageAssetPaths('legacy.png').length, 1);
  assert.equal(failures, 0, `${failures} upload review regression(s)`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
