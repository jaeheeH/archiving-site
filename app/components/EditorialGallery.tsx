'use client';
import { useRef } from 'react';
import ArchiveImage from './ArchiveImage';

// Native scroll snapping keeps the reader free of both the editor and a slider runtime.
export default function EditorialGallery({ images, slider }: { images: string[]; slider: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  if (!images.length) return null;
  return <div className="image-gallery-readonly my-8">
    <div ref={track} className={slider ? 'editorial-image-slider' : 'editorial-image-grid'} tabIndex={slider ? 0 : undefined} aria-label={slider ? '본문 이미지 슬라이더' : '본문 이미지 갤러리'}>
      {images.map((src, index) => <ArchiveImage key={`${src}-${index}`} src={src} width={1200} height={800} sizes={slider ? '(max-width: 768px) 100vw, 820px' : '(max-width: 768px) 100vw, 400px'} alt={`본문 이미지 ${index + 1}`} loading="lazy" onLoad={event => { const img = event.currentTarget; if (!slider && img.naturalHeight) img.style.flexGrow = String(img.naturalWidth / img.naturalHeight); }} />)}
    </div>
    {slider && <div className="mt-3 flex justify-center gap-3"><button type="button" aria-label="이전 이미지" onClick={() => track.current?.scrollBy({ left: -track.current.clientWidth, behavior: 'smooth' })}>←</button><button type="button" aria-label="다음 이미지" onClick={() => track.current?.scrollBy({ left: track.current.clientWidth, behavior: 'smooth' })}>→</button></div>}
  </div>;
}
