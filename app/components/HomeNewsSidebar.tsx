'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export default function HomeNewsSidebar({ children }: { children: ReactNode }) {
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = sidebar.current;
    if (!node) return;
    // A tall sidebar scrolls naturally until its bottom fits above the viewport edge.
    const measure = () => node.style.setProperty('--news-sidebar-height', `${node.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <aside ref={sidebar} className="news-sidebar news-home-sidebar" aria-label="뉴스 탐색">{children}</aside>;
}
