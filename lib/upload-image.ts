import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { WEBP_WIDTHS, WEBP_SUFFIX, VARIANT_WIDTH_PARAM, imageAssetPaths } from './image-variants';

/** Decode once per size, with bounded pixels, and never replace the uploaded bytes. */
export async function createWebpVariants(buffer: Buffer) {
  const input = sharp(buffer, { limitInputPixels: 40_000_000, animated: true });
  const metadata = await input.metadata();
  if (!['jpeg', 'png', 'webp', 'gif', 'avif'].includes(metadata.format || '')) throw new Error('지원하지 않는 이미지 파일입니다.');
  // Keep animation intact instead of silently turning it into a still image.
  if ((metadata.pages || 1) > 1) return { metadata, variants: [] };
  const variants = [];
  for (const width of WEBP_WIDTHS) {
    const { data, info } = await sharp(buffer, { limitInputPixels: 40_000_000 }).rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 }).toBuffer({ resolveWithObject: true });
    variants.push({ width, data, actualWidth: info.width, actualHeight: info.height });
  }
  return { metadata, variants };
}

export async function uploadImageWithVariants(client: Pick<SupabaseClient, 'storage'>, bucket: string, originalPath: string, buffer: Buffer, contentType: string, options?: { preserveFormat?: boolean; stagingPath?: string }) {
  if (originalPath.startsWith('/') || originalPath.includes('..') || !/^[a-zA-Z0-9._/-]+$/.test(originalPath)) throw new Error('올바르지 않은 이미지 경로입니다.');
  if (/\.archb-v1-w\d+\.webp$/.test(originalPath)) throw new Error('예약된 이미지 파일명입니다.');
  if (options?.stagingPath && (options.stagingPath === originalPath || !/^direct\/[a-zA-Z0-9_-]+\/[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(options.stagingPath))) throw new Error('올바르지 않은 임시 업로드 경로입니다.');
  const icon = ['image/x-icon', 'image/vnd.microsoft.icon'].includes(contentType);
  const prepared = icon || options?.preserveFormat ? { metadata: null, variants: [] } : await createWebpVariants(buffer);
  const storage = client.storage.from(bucket);
  const created: string[] = [];
  const uploadOptions = { cacheControl: '31536000', upsert: false };
  const publicUrl = (path: string) => storage.getPublicUrl(path).data.publicUrl;
  try {
    // Write new derivatives first. A failure cannot delete or replace an original.
    for (const variant of prepared.variants) {
      const path = `${originalPath}${WEBP_SUFFIX}${variant.width}.webp`;
      const { error } = await storage.upload(path, variant.data, { ...uploadOptions, contentType: 'image/webp' });
      if (error) throw error;
      created.push(path);
    }
    const { error } = await storage.upload(originalPath, buffer, { ...uploadOptions, contentType });
    if (error) throw error;
  } catch (error) {
    if (created.length) await storage.remove(created);
    throw error;
  }
  if (options?.stagingPath) {
    const cleanup = await storage.remove([options.stagingPath]);
    if (cleanup.error) {
      const retry = await storage.remove([options.stagingPath]);
      if (retry.error) console.error('원본 전송 임시 파일 정리 실패', { bucket, path: options.stagingPath, error: retry.error });
    }
  }
  const maxWidth = prepared.variants.at(-1)?.actualWidth;
  const allVariants = prepared.variants.map(item => ({
    width: item.actualWidth,
    url: `${publicUrl(`${originalPath}${WEBP_SUFFIX}${item.width}.webp`)}?${VARIANT_WIDTH_PARAM}=${maxWidth}`,
  }));
  const variants = allVariants.filter((item, index) => allVariants.findIndex(other => other.width === item.width) === index);
  const original_url = publicUrl(originalPath);
  const display = allVariants.at(-1);
  return {
    url: display?.url || original_url,
    path: display ? `${originalPath}${WEBP_SUFFIX}1280.webp` : originalPath,
    original_url, original_path: originalPath, variants,
    width: prepared.variants.at(-1)?.actualWidth || prepared.metadata?.width,
    height: prepared.variants.at(-1)?.actualHeight || prepared.metadata?.height,
  };
}

/** Copy the original and every derivative together; retain the old family until post saving succeeds. */
export async function copyImageFamily(client: Pick<SupabaseClient, 'storage'>, bucket: string, from: string, to: string) {
  const storage = client.storage.from(bucket);
  const fromPaths = imageAssetPaths(from);
  const toPaths = imageAssetPaths(to);
  const created: string[] = [];
  try {
    for (let i = 0; i < fromPaths.length; i++) {
      const { data, error } = await storage.download(fromPaths[i]);
      if (error || !data) throw error || new Error('이미지 원본을 찾을 수 없습니다.');
      const { error: uploadError } = await storage.upload(toPaths[i], data, { contentType: data.type, cacheControl: '31536000', upsert: false });
      if (uploadError) {
        // A cover and a body image can refer to the same family. Reuse only
        // byte-identical copies; never overwrite a different existing asset.
        const existing = await storage.download(toPaths[i]);
        if (!existing.error && existing.data && Buffer.from(await data.arrayBuffer()).equals(Buffer.from(await existing.data.arrayBuffer()))) continue;
        throw uploadError;
      }
      created.push(toPaths[i]);
    }
  } catch (error) {
    if (created.length) await storage.remove(created);
    throw error;
  }
}
