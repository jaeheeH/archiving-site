'use client';
import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import { canOptimizeImage } from '@/lib/public-image';
import { preoptimizedVariants, preoptimizedUrl, originalImageUrl } from '@/lib/image-variants';

export default function ArchiveImage({ src, alt, unoptimized, onError, ...props }: ImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps['src'] | null>(null);
  const prepared = typeof src === 'string' && preoptimizedVariants(src);
  if (prepared && failedSource !== src && !unoptimized) return <Image {...props} src={src} alt={alt}
    loader={({ src: source, width }) => preoptimizedUrl(source, width)}
    onError={() => setFailedSource(src)} />;
  const useOriginal = unoptimized || failedSource === src || (typeof src === 'string' && !canOptimizeImage(src));
  const fallbackSrc = prepared && failedSource === src && typeof src === 'string' ? originalImageUrl(src) : src;
  return <Image {...props} src={fallbackSrc} alt={alt} unoptimized={useOriginal}
    onError={event => {
      if (!useOriginal) setFailedSource(src);
      else onError?.(event);
    }} />;
}
