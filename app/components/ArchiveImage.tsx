'use client';
import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import { canOptimizeImage } from '@/lib/public-image';

export default function ArchiveImage({ src, alt, unoptimized, onError, ...props }: ImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps['src'] | null>(null);
  return <Image {...props} src={src} alt={alt} unoptimized={unoptimized || failedSource === src || (typeof src === 'string' && !canOptimizeImage(src))}
    onError={event => { setFailedSource(src); onError?.(event); }} />;
}
