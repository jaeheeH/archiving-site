'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { layoutMasonry } from '@/lib/masonry-layout';

export default function ArchiveMasonry({ children, label, id }: { children: ReactNode; label: string; id?: string }) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    const cards = Array.from(container.children) as HTMLElement[];
    const layout = () => {
      const style = getComputedStyle(container);
      const columns = parseInt(style.getPropertyValue('--masonry-columns'), 10) || 1;
      const columnGap = parseFloat(style.columnGap);
      const width = (container.clientWidth - columnGap * (columns - 1)) / columns;
      cards.forEach(card => { card.style.width = `${width}px`; });
      const { positions, height } = layoutMasonry(cards.map(card => card.getBoundingClientRect().height), columns, parseFloat(style.rowGap));
      cards.forEach((card, index) => {
        const { column, top } = positions[index];
        card.style.transform = `translate(${column * (width + columnGap)}px, ${top}px)`;
      });
      container.style.height = `${height}px`;
      container.dataset.layout = 'ready';
    };
    layout();

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    });
    observer.observe(container);
    cards.forEach(card => observer.observe(card));
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [children]);

  return <section ref={ref} id={id} aria-label={label} className="archive-masonry">{children}</section>;
}
