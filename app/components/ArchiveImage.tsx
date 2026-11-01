'use client';
import Image, { getImageProps, type ImageProps } from 'next/image';
import { preload } from 'react-dom';
import { useState } from 'react';
import { canOptimizeImage } from '@/lib/public-image';
import { preoptimizedVariants, originalImageUrl } from '@/lib/image-variants';

export default function ArchiveImage({ src, alt, unoptimized, onError, ...props }: ImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps['src'] | null>(null);
  const [loadedSource, setLoadedSource] = useState<ImageProps['src'] | null>(null);
  const prepared = typeof src === 'string' && preoptimizedVariants(src);
  if (prepared && failedSource !== src && !unoptimized) {
    const srcSet = prepared.filter(item => item.width !== undefined).map(item => `${item.url} ${item.width}w`).join(', ') || undefined;
    const displaySrc = prepared.at(-1)!.url;
    const eager = props.preload || props.priority;
    const { props: imageProps } = getImageProps({ ...props, src: displaySrc, alt, unoptimized: true,
      loading: eager ? 'eager' : props.loading, placeholder: loadedSource === src ? 'empty' : props.placeholder });
    if (eager) preload(displaySrc, { as: 'image', imageSrcSet: srcSet, imageSizes: props.sizes, crossOrigin: props.crossOrigin, referrerPolicy: props.referrerPolicy, fetchPriority: props.fetchPriority || 'high' });
    // Prepared files already have exact responsive widths; Next's default width
    // list must not relabel them or send them through a second optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...imageProps} alt={alt} srcSet={srcSet} sizes={props.sizes} fetchPriority={props.fetchPriority || (eager ? 'high' : undefined)}
      onLoad={event => { setLoadedSource(src); props.onLoad?.(event); props.onLoadingComplete?.(event.currentTarget); }}
      onError={() => setFailedSource(src)} />;
  }
  const useOriginal = unoptimized || failedSource === src || (typeof src === 'string' && !canOptimizeImage(src));
  const fallbackSrc = prepared && failedSource === src && typeof src === 'string' ? originalImageUrl(src) : src;
  return <Image {...props} src={fallbackSrc} alt={alt} unoptimized={useOriginal}
    onError={event => {
      if (!useOriginal) setFailedSource(src);
      else onError?.(event);
    }} />;
}
