'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef } from 'react';
import { ART_PAGE_SIZE } from '@/lib/art-list';

export default function ArtworkLoadMore({ shown, total, moreHref }: { shown: number; total: number; moreHref: string | null }) {
  const previousShown = useRef(shown);
  const clickedMore = useRef(false);
  useLayoutEffect(() => {
    if (clickedMore.current && shown > previousShown.current) {
      document.getElementById('artwork-list')?.querySelectorAll<HTMLAnchorElement>('.archive-media')[previousShown.current]?.focus({ preventScroll: true });
    }
    clickedMore.current = false;
    previousShown.current = shown;
  }, [shown]);

  return <div className="archive-load-more">
    <p role="status" aria-live="polite" aria-atomic="true">{shown} / {total}점</p>
    {moreHref
      ? <Link href={moreHref} scroll={false} prefetch={false} onNavigate={() => { clickedMore.current = true; }} className="archive-button archive-button-secondary" aria-controls="artwork-list">작품 {Math.min(ART_PAGE_SIZE, total - shown)}점 더보기</Link>
      : <p>모든 작품을 확인했습니다.</p>}
  </div>;
}
