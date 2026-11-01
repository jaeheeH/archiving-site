// Mocked storage only. Run: tsx scripts/check-webp-images.ts
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createWebpVariants, uploadImageWithVariants, copyImageFamily } from '../lib/upload-image';
import { originalImageUrl, preoptimizedUrl, preoptimizedVariants, imageAssetPaths } from '../lib/image-variants';
import type { SupabaseClient } from '@supabase/supabase-js';
import { imageUploadForm } from '../lib/image-upload-form';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';

async function main() {
  const png = await sharp({ create: { width: 1800, height: 1000, channels: 4, background: '#24874880' } }).png().toBuffer();
  const checksum = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const originalChecksum = checksum(png);
  const { variants } = await createWebpVariants(png);
  assert.deepEqual(variants.map(item => item.actualWidth), [160, 320, 640, 1280]);
  for (const variant of variants) {
    const meta = await sharp(variant.data).metadata();
    assert.equal(meta.format, 'webp'); assert.equal(meta.hasAlpha, true);
    assert.equal(meta.width, variant.actualWidth);
  }
  assert.equal(checksum(png), originalChecksum, 'Conversion cannot modify original bytes');
  const small = await sharp(png).resize(80).png().toBuffer();
  assert((await createWebpVariants(small)).variants.every(item => item.actualWidth === 80), 'Never upscale');
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAAAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  const animated = Buffer.concat([gif.subarray(0, -1), gif.subarray(19, -1), Buffer.from([59])]);
  assert.equal((await sharp(animated, { animated: true }).metadata()).pages, 2);
  assert.equal((await createWebpVariants(animated)).variants.length, 0, 'Preserve animation');

  const objects = new Map<string, { bytes: Buffer; type: string }>();
  let failAt = ''; const removed: string[][] = [];
  const storage = {
    createSignedUploadUrl: async (path: string, options: { upsert: boolean }) => { assert.equal(options.upsert, false); return { data: { path, token: 'test-only-token' }, error: null }; },
    upload: async (path: string, bytes: Buffer | Blob, options: { upsert: boolean; contentType: string }) => {
      assert.equal(options.upsert, false);
      if (path === failAt || objects.has(path)) return { error: new Error('Simulated storage failure') };
      objects.set(path, { bytes: Buffer.isBuffer(bytes) ? Buffer.from(bytes) : Buffer.from(await bytes.arrayBuffer()), type: options.contentType });
      return { error: null };
    },
    download: async (path: string) => ({ data: objects.has(path) ? new Blob([new Uint8Array(objects.get(path)!.bytes)], { type: objects.get(path)!.type }) : null, error: null }),
    remove: async (paths: string[]) => { removed.push(paths); paths.forEach(path => objects.delete(path)); return { error: null }; },
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://overgjynkrnwayfammid.supabase.co/storage/v1/object/public/posts/${path}` } }),
  };
  const client = { storage: { from: () => storage } } as unknown as Pick<SupabaseClient, 'storage'>;
  const result = await uploadImageWithVariants(client, 'posts', 'temp/owner/photo.png', png, 'image/png');
  assert.equal(objects.size, 5);
  assert.equal(checksum(objects.get(result.original_path)!.bytes), originalChecksum);
  assert.equal(originalImageUrl(result.url), result.original_url);
  assert.equal(preoptimizedVariants(result.url)?.length, 4);
  assert.equal(preoptimizedUrl(result.url, 300), result.variants[1].url);
  assert.equal(preoptimizedVariants('https://attacker.example/photo.png.archb-v1-w640.webp'), null);
  assert.equal(preoptimizedVariants('https://overgjynkrnwayfammid.supabase.co.attacker.example/storage/v1/object/public/posts/x.archb-v1-w640.webp'), null);
  assert.equal(imageAssetPaths(result.path).length, 5);
  await copyImageFamily(client, 'posts', result.path, result.path.replace('temp/owner/', 'blog/post/'));
  assert.equal(objects.size, 10);
  assert.equal(checksum(objects.get('blog/post/photo.png')!.bytes), originalChecksum);
  assert(objects.has(result.original_path), 'Saving a post cannot delete its uploaded original');
  const before = objects.size;
  await assert.rejects(uploadImageWithVariants(client, 'posts', '../bad.png', png, 'image/png'));
  await assert.rejects(uploadImageWithVariants(client, 'posts', 'bad.png', Buffer.from('invalid'), 'image/png'));
  assert.equal(objects.size, before);
  failAt = 'failure.png.archb-v1-w640.webp';
  await assert.rejects(uploadImageWithVariants(client, 'posts', 'failure.png', png, 'image/png'));
  assert.equal(objects.size, before, 'Partial derivatives must roll back');
  assert(removed.at(-1)!.every(path => path.startsWith('failure.png.archb-v1-w')));
  failAt = '';
  objects.set('existing.png', { bytes: png, type: 'image/png' });
  await assert.rejects(uploadImageWithVariants(client, 'posts', 'existing.png', png, 'image/png'));
  assert.equal(checksum(objects.get('existing.png')!.bytes), originalChecksum, 'A collision cannot overwrite/delete an original');
  const animation = await uploadImageWithVariants(client, 'posts', 'animation.gif', animated, 'image/gif');
  assert.equal(animation.url, animation.original_url);
  assert.equal(checksum(objects.get('animation.gif')!.bytes), checksum(animated));
  const smallUpload = await uploadImageWithVariants(client, 'posts', 'small.png', small, 'image/png');
  const smallVariants = preoptimizedVariants(smallUpload.url)!;
  assert.equal(smallVariants.length, 1, 'A small uploaded original must not be advertised under four larger widths');
  assert.equal(smallVariants[0].width, 80);
  assert.equal(originalImageUrl(smallUpload.url), smallUpload.original_url, 'Display-size metadata must not change the original URL');

  const stage = (body: unknown) => new Request('https://test.local/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const prepared = await imageUploadForm(stage({ stage: 'prepare', type: 'image/png', size: 6 * 1024 * 1024 }), client, 'posts', 'owner');
  assert(prepared instanceof Response); assert.equal(prepared.status, 200);
  const signed = (await prepared.json()).upload;
  assert(signed.path.startsWith('direct/owner/')); assert.equal(signed.bucket, 'posts');
  objects.set(signed.path, { bytes: png, type: 'image/png' });
  const completed = await imageUploadForm(stage({ stage: 'complete', path: signed.path, name: 'original.png', fields: { folder: 'titles', fileName: 'original.png' } }), client, 'posts', 'owner');
  assert(!(completed instanceof Response));
  assert.equal(completed.stagingPath, signed.path);
  assert.equal(completed.formData.get('folder'), 'titles');
  assert.equal(checksum(Buffer.from(await (completed.formData.get('file') as File).arrayBuffer())), originalChecksum);
  for (const body of [null, { stage: 'prepare', type: 'image/svg+xml', size: 100 }, { stage: 'prepare', type: 'image/png', size: 9 * 1024 * 1024 }, { stage: 'complete', path: signed.path.replace('/owner/', '/another-user/') }, { stage: 'complete', path: 'direct/owner/../../secret.png' }]) {
    const invalid = await imageUploadForm(stage(body), client, 'posts', 'owner');
    assert(invalid instanceof Response); assert.equal(invalid.status, 400);
  }

  // Run the browser upload coordinator with real File/FormData and mocked I/O.
  const requests: { body: FormData | string }[] = []; let denied = false; let directFile: File | null = null;
  const clientModule = { exports: {} as { uploadImageFile: (endpoint: string, form: FormData) => Promise<Response> } };
  const code = ts.transpileModule(await readFile('lib/upload-image-client.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { module: clientModule, exports: clientModule.exports, File, FormData, Object, JSON, Error,
    require: () => ({ createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: async (_path: string, _token: string, file: File) => { directFile = file; return { error: null }; } }) } }) }),
    fetch: async (_endpoint: string, options: { body: FormData | string }) => {
      requests.push(options);
      if (denied) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (typeof options.body === 'string' && JSON.parse(options.body).stage === 'prepare') return Response.json({ upload: { bucket: 'posts', path: 'direct/owner/test.png', token: 'test-only-token' } });
      return Response.json({ url: result.url });
    },
  });
  const largeFile = new File([new Uint8Array(png), new Uint8Array(5 * 1024 * 1024)], 'large.png', { type: 'image/png' });
  const largeForm = new FormData(); largeForm.set('file', largeFile); largeForm.set('folder', 'titles');
  assert.equal((await clientModule.exports.uploadImageFile('/api/upload', largeForm)).status, 200);
  assert.equal(directFile, largeFile, 'Send the exact original directly to Storage');
  assert.equal(requests.length, 2);
  assert(requests.every(request => typeof request.body === 'string' && request.body.length < 1024), 'The app server only receives small JSON requests');
  assert.equal(JSON.parse(requests[1].body as string).fields.folder, 'titles');
  requests.length = 0; directFile = null; denied = true;
  assert.equal((await clientModule.exports.uploadImageFile('/api/upload', largeForm)).status, 401);
  assert.equal(directFile, null, 'Never upload before authorization');
  denied = false; requests.length = 0;
  const smallForm = new FormData(); smallForm.set('file', new File([new Uint8Array(png)], 'small.png', { type: 'image/png' }));
  assert.equal((await clientModule.exports.uploadImageFile('/api/upload', smallForm)).status, 200);
  assert.equal(requests.length, 1); assert.equal(requests[0].body, smallForm);

  const manifest = JSON.parse(await readFile('research/home-images.json', 'utf8'));
  let count = 0;
  for (const [source, entry] of Object.entries(manifest.images) as [string, { variants: { width: number; url: string }[] }][]) {
    assert(preoptimizedVariants(source));
    for (const variant of entry.variants) {
      const meta = await sharp(await readFile(`public${variant.url}`)).metadata();
      assert.equal(meta.format, 'webp'); assert.equal(meta.width, variant.width); count++;
    }
  }
  console.log(`WebP checks passed: ${count} prepared assets, exact original preservation, responsive selection, transparent pixels, no upscaling, animation, atomic upload failure, collisions, complete post copies and authorized direct upload without large API bodies. No live data changed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
