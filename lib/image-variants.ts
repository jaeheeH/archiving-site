import homeImages from '@/research/home-images.json';
import { canOptimizeImage } from './public-image';

export const WEBP_WIDTHS = [160, 320, 640, 1280] as const;
export const WEBP_SUFFIX = '.archb-v1-w';
const variantPattern = /\.archb-v1-w(160|320|640|1280)\.webp$/;
type ImageVariant = { width: number; url: string };
type HomeImage = { variants: ImageVariant[] };
const images = homeImages.images as Record<string, HomeImage>;

export function preoptimizedVariants(source: string): ImageVariant[] | null {
  if (Object.hasOwn(images, source)) return images[source].variants;
  try {
    const url = new URL(source);
    if (!canOptimizeImage(source) || !url.pathname.includes('/storage/v1/object/public/') || !variantPattern.test(url.pathname)) return null;
    const base = source.replace(/\.archb-v1-w(160|320|640|1280)\.webp(?=\?|$)/, '');
    return WEBP_WIDTHS.map(width => {
      const variant = new URL(base);
      variant.pathname += `${WEBP_SUFFIX}${width}.webp`;
      return { width, url: variant.href };
    });
  } catch { return null; }
}

export function preoptimizedUrl(source: string, width: number) {
  const variants = preoptimizedVariants(source);
  return variants?.find(item => item.width >= width)?.url || variants?.at(-1)?.url || source;
}

/** The original is never overwritten; the derivative URL retains its path. */
export function originalImageUrl(source: string) {
  if (!preoptimizedVariants(source) || Object.hasOwn(images, source)) return source;
  const url = new URL(source);
  url.pathname = url.pathname.replace(variantPattern, '');
  return url.href;
}

export function imageAssetPaths(path: string) {
  const original = path.replace(variantPattern, '');
  return original === path ? [path] : [original, ...WEBP_WIDTHS.map(width => `${original}${WEBP_SUFFIX}${width}.webp`)];
}
