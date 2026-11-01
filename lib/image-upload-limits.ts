export const MAX_BRAND_IMAGE_BYTES = 12 * 1024 * 1024;

export function imageUploadMaxBytes(bucket: string) {
  return bucket === 'brand-assets' ? MAX_BRAND_IMAGE_BYTES : 8 * 1024 * 1024;
}
