'use client';
import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import { canOptimizeImage } from '@/lib/public-image';

export default function ArchiveImage({ src, alt, unoptimized, onError, ...props }: ImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps['src'] | null>(null);
  const useOriginal = unoptimized || failedSource === src || (typeof src === 'string' && !canOptimizeImage(src));
  return <Image {...props} src={src} alt={alt} unoptimized={useOriginal}
    onError={event => {
      if (!useOriginal) setFailedSource(src);
      else onError?.(event);
    }} />;
}
