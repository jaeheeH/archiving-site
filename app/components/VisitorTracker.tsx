'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { publicPage } from '@/lib/site-traffic';

export default function VisitorTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const firstView = useRef(true);
  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    const page = publicPage(pathname);
    lastPath.current = pathname;
    if (!page || navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    let sent = false;
    // A visibility-gated first-party request avoids counting prefetched or unopened tabs.
    const send = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', send);
      sent = true;
      const body = JSON.stringify({ id: crypto.randomUUID(), path: page.path, referrer: firstView.current ? document.referrer : '' });
      firstView.current = false;
      // Serial requests let the first response establish cookies before a fast SPA navigation.
      pending.current = pending.current.then(async () => {
        await fetch('/api/analytics/pageview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body });
      }).catch(() => {});
    };
    document.addEventListener('visibilitychange', send);
    send();
    return () => {
      document.removeEventListener('visibilitychange', send);
      if (!sent && lastPath.current === pathname) lastPath.current = null;
    };
  }, [pathname]);
  return null;
}
