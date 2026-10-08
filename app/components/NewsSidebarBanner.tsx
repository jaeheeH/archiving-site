'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import ArchiveImage from './ArchiveImage';
import { bannerImage, bannerLink, type Banner } from '@/lib/banners';

export default function NewsSidebarBanner({ banner, preview = false }: { banner?: Banner | null; preview?: boolean }) {
  const element = useRef<HTMLDivElement>(null);
  const viewId = useRef<string | null>(null);
  const pathname = usePathname();
  function track(type: 'impression' | 'click', id: string = crypto.randomUUID()) {
    if (preview || !banner || !['/', '/news/stories'].includes(pathname) || navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    const body = JSON.stringify({ id, type, path: pathname });
    const url = `/api/banners/${banner.id}/events`;
    if (!navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) void fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }
  useEffect(() => {
    const node = element.current, image = node?.querySelector('img');
    if (preview || !banner || !node || !image) return;
    viewId.current = crypto.randomUUID();
    let visible = false, sent = false, timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      if (!sent && visible && document.visibilityState === 'visible' && image.complete && image.naturalWidth > 0) timer = setTimeout(() => {
        sent = true; track('impression', viewId.current!); observer.disconnect();
      }, 1000);
    };
    const observer = new IntersectionObserver(entries => { visible = entries[0].intersectionRatio >= .5; update(); }, { threshold: .5 });
    observer.observe(node);
    image.addEventListener('load', update);
    document.addEventListener('visibilitychange', update);
    return () => { clearTimeout(timer); observer.disconnect(); image.removeEventListener('load', update); document.removeEventListener('visibilitychange', update); };
    // Each page display has one event ID; retries are idempotent in the database.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner?.id, banner?.image_url, pathname, preview]);
  const image = bannerImage(banner?.image_url);
  if (!banner || !image) return null;
  const href = bannerLink(banner.link);
  const external = href && /^https?:/.test(href);
  const content = <div className="news-sidebar-ad-image"><ArchiveImage src={image} alt={banner.title} width={1000} height={400} sizes="(max-width: 950px) 300px, (max-width: 1150px) 205px, 290px" loading="lazy" />{banner.kind === 'ad' && <span className="news-sidebar-ad-badge">AD</span>}</div>;
  return <div ref={element} className="news-sidebar-ad" aria-label={banner.kind === 'ad' ? '광고 배너' : '추천 링크 배너'} data-banner-id={banner.id}>
    {href ? <a className="news-sidebar-ad-card" href={href} onClick={() => track('click')} onAuxClick={event => { if (event.button === 1) track('click'); }} target={external || preview ? '_blank' : undefined} rel={external ? `${banner.kind === 'ad' ? 'sponsored ' : ''}noopener noreferrer` : preview ? 'noopener noreferrer' : undefined}>{content}</a> : <div className="news-sidebar-ad-card">{content}</div>}
  </div>;
}
