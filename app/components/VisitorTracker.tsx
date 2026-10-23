'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { publicPage } from '@/lib/site-traffic';
import { activeClock, analyticsTarget, readingDepth, searchKeyword } from '@/lib/engagement';

export default function VisitorTracker() {
  const pathname = usePathname();
  const current = useRef<{ path: string; id: string } | null>(null);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const firstView = useRef(true);
  useEffect(() => {
    if (current.current?.path !== pathname) current.current = { path: pathname, id: crypto.randomUUID() };
    const page = publicPage(pathname);
    if (!page || navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    const viewId = current.current!.id, clock = activeClock(performance.now()), seen = new Set<string>();
    let started = false, ignored = false, seconds = 0, depth: number | null = null;
    let sentSeconds = -1, sentDepth: number | null | undefined;
    let search: { id: string; key: string; marker: Element } | null = null;
    let searchTimer: ReturnType<typeof setTimeout>;
    const visible = () => document.visibilityState === 'visible' && document.hasFocus();
    const reading = () => {
      const body = document.querySelector('[data-analytics-body]')?.getBoundingClientRect();
      return visible() && (!body || body.top < window.innerHeight && body.bottom > 0);
    };
    const send = (data: Record<string, unknown>) => {
      if (!started || ignored) return;
      const body = JSON.stringify({ id: crypto.randomUUID(), viewId, ...data });
      pending.current = pending.current.then(async () => {
        if (!ignored) await fetch('/api/analytics/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body });
      }).catch(() => {});
    };
    const once = (kind: string, target: string, extra: Record<string, unknown> = {}) => {
      const key = `${kind}:${target}:${extra.searchId || ''}:${extra.errorKind || ''}`;
      if (seen.has(key)) return;
      seen.add(key); send({ kind, target, ...extra });
    };
    const measure = () => {
      if (!visible()) return;
      const body = document.querySelector('[data-analytics-body]');
      if (!body) return;
      const rect = body.getBoundingClientRect(), value = readingDepth(rect.top, rect.height, window.innerHeight);
      if (value !== null) depth = Math.max(depth || 0, value);
    };
    const inspectSearch = () => {
      const marker = document.querySelector('[data-analytics-query]');
      const query = searchKeyword(marker?.getAttribute('data-analytics-query'));
      const count = Number(marker?.getAttribute('data-analytics-results'));
      const key = `${query}:${count}:${marker?.getAttribute('data-analytics-scope') || ''}`;
      if (!marker || !query || !Number.isInteger(count) || count < 0) { search = null; return; }
      if (search?.key === key || !visible()) return;
      search = { id: crypto.randomUUID(), key, marker };
      send({ kind: 'search', query, results: count, searchId: search.id });
    };
    const flush = (read = true) => {
      if (read) measure();
      if (seconds === sentSeconds && depth === sentDepth) return;
      sentSeconds = seconds; sentDepth = depth;
      send({ kind: 'engagement', activeSeconds: seconds, depth });
    };
    const start = () => {
      if (started || document.visibilityState !== 'visible') return;
      started = true;
      const body = JSON.stringify({ id: viewId, path: page.path, referrer: firstView.current ? document.referrer : '', campaign: window.location.search });
      firstView.current = false;
      pending.current = pending.current.then(async () => {
        const response = await fetch('/api/analytics/pageview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body });
        ignored = !response.ok || response.headers.get('X-Analytics-Ignored') === '1';
      }).catch(() => { ignored = true; });
      measure(); inspectSearch();
    };
    let wasVisible = reading();
    const activity = () => { seconds = clock.tick(performance.now(), wasVisible, true); wasVisible = reading(); measure(); };
    const visibility = () => {
      seconds = clock.tick(performance.now(), wasVisible, true); wasVisible = reading(); start();
      if (!wasVisible) flush(); else { measure(); inspectSearch(); }
    };
    const click = (event: MouseEvent) => {
      activity();
      const element = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!element || element.hasAttribute('download')) return;
      const url = new URL((element as HTMLAnchorElement).href, window.location.href);
      const target = analyticsTarget(url.origin === window.location.origin ? url.pathname : url.href);
      if (!target) return;
      inspectSearch();
      if (search && search.marker.contains(element) && (url.origin !== window.location.origin || publicPage(url.pathname)?.label.endsWith('상세'))) once('search_click', target, { searchId: search.id });
      if (url.origin !== window.location.origin) once('outbound', target);
      else if (url.pathname !== pathname) once('navigation', target);
      flush();
    };
    const saved = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.scraped || !['post', 'artwork', 'artist', 'reference', 'gallery'].includes(detail.type) || typeof detail.id !== 'string') return;
      const resource = [...document.querySelectorAll('[data-analytics-resource]')].find(item => item.getAttribute('data-analytics-resource') === `${detail.type}:${detail.id}`);
      const target = analyticsTarget(resource?.getAttribute('data-analytics-path') || page.path);
      if (target) once('save', target);
    };
    const failure = (event: Event) => {
      // Let image optimization fallback finish before recording a broken image.
      if (event.target instanceof HTMLImageElement) {
        const image = event.target;
        setTimeout(() => { if (image.isConnected && image.complete && !image.naturalWidth) once('error', '', { errorKind: 'image' }); }, 5000);
      } else if (event instanceof ErrorEvent) once('error', '', { errorKind: 'javascript' });
    };
    const observer = new MutationObserver(() => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { measure(); inspectSearch(); }, 600); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-analytics-query', 'data-analytics-results', 'data-analytics-scope'] });
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', visibility); window.addEventListener('blur', visibility);
    document.addEventListener('pointerdown', activity, { passive: true }); document.addEventListener('keydown', activity);
    document.addEventListener('scroll', activity, { passive: true, capture: true }); document.addEventListener('click', click, true);
    const hide = () => { seconds = clock.tick(performance.now(), wasVisible); flush(); };
    window.addEventListener('archb-saved-change', saved); window.addEventListener('error', failure, true); window.addEventListener('pagehide', hide);
    const timer = setInterval(() => { seconds = clock.tick(performance.now(), wasVisible); wasVisible = reading(); if (visible()) { start(); flush(); } }, 15000);
    start();
    return () => {
      seconds = clock.tick(performance.now(), wasVisible); flush(false);
      clearInterval(timer); clearTimeout(searchTimer); observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', visibility); window.removeEventListener('blur', visibility);
      document.removeEventListener('pointerdown', activity); document.removeEventListener('keydown', activity); document.removeEventListener('scroll', activity, true);
      document.removeEventListener('click', click, true); window.removeEventListener('archb-saved-change', saved);
      window.removeEventListener('error', failure, true); window.removeEventListener('pagehide', hide);
    };
  }, [pathname]);
  return null;
}
