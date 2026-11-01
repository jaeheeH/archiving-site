import homeImages from '@/research/home-images.json';
import { canOptimizeImage } from './public-image';

export const WEBP_WIDTHS = [160, 320, 640, 1280] as const;
export const WEBP_SUFFIX = '.archb-v1-w';
export const VARIANT_WIDTH_PARAM = 'archb-width';
const variantPattern = /\.archb-v1-w(160|320|640|1280)\.webp$/;
type ImageVariant = { width?: number; url: string };
type HomeImage = { variants: ImageVariant[] };
const images = homeImages.images as Record<string, HomeImage>;

export function preoptimizedVariants(source: string): ImageVariant[] | null {
  if (Object.hasOwn(images, source)) return images[source].variants;
  try {
    const url = new URL(source);
    if (!canOptimizeImage(source) || !url.pathname.includes('/storage/v1/object/public/') || !variantPattern.test(url.pathname)) return null;
    const maxWidth = Number(url.searchParams.get(VARIANT_WIDTH_PARAM));
    // Older uploads have no encoded dimensions. Serve their known file directly
    // rather than inventing width descriptors for a potentially small original.
    if (!Number.isInteger(maxWidth) || maxWidth < 1 || maxWidth > 1280) return [{ url: source }];
    const originalPath = url.pathname.replace(variantPattern, '');
    const variants: ImageVariant[] = [];
    for (const requestedWidth of WEBP_WIDTHS) {
      const width = Math.min(requestedWidth, maxWidth);
      if (variants.some(item => item.width === width)) continue;
      const variant = new URL(url);
      variant.pathname = `${originalPath}${WEBP_SUFFIX}${requestedWidth}.webp`;
      variants.push({ width, url: variant.href });
    }
    return variants;
  } catch { return null; }
}

export function preoptimizedUrl(source: string, width: number) {
  const variants = preoptimizedVariants(source);
  return variants?.find(item => item.width !== undefined && item.width >= width)?.url || variants?.at(-1)?.url || source;
}

/** The original is never overwritten; the derivative URL retains its path. */
export function originalImageUrl(source: string) {
  if (!preoptimizedVariants(source) || Object.hasOwn(images, source)) return source;
  const url = new URL(source);
  url.pathname = url.pathname.replace(variantPattern, '');
  url.searchParams.delete(VARIANT_WIDTH_PARAM);
  return url.href;
}

export function imageAssetPaths(path: string) {
  const original = path.replace(variantPattern, '');
  return original === path ? [path] : [original, ...WEBP_WIDTHS.map(width => `${original}${WEBP_SUFFIX}${width}.webp`)];
}
