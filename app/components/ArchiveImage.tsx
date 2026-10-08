'use client';
import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import { canOptimizeImage } from '@/lib/public-image';

export default function ArchiveImage({ src, alt, ...props }: ImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps['src'] | null>(null);
  return <Image {...props} src={src} alt={alt} unoptimized={failedSource === src || (typeof src === 'string' && !canOptimizeImage(src))}
    onError={() => setFailedSource(src)} />;
}
