'use client';
import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ToastProvider';
import { resourceType, type ResourceType } from '@/lib/resource';
import { SAVE_INTENT_KEY, readSaveIntent, saveLoginHref, scrapEndpoint, notifySaved } from '@/lib/save-intent';

type SavedContextValue = { ready: boolean; counts: Map<string,number>; keys: Set<string>; busy: Set<string>; toggle: (type: ResourceType, id: string) => Promise<void> };
const SavedContext = createContext<SavedContextValue | null>(null);
export default function SavedProvider({ children }: { children: ReactNode }) {
  const [ready,setReady]=useState(false);
  const [counts,setCounts]=useState(new Map<string,number>());
  const [keys, setKeys] = useState(new Set<string>());
  const [busy, setBusy] = useState(new Set<string>());
  const account = useRef<string | null>(null);
  const loaded = useRef<string | null>(null);
  const pendingRequests = useRef(new Set<string>());
  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useToast();
  const update = useCallback((key: string, scraped: boolean) => setKeys(prev => { const next = new Set(prev); if (scraped) next.add(key); else next.delete(key); return next; }), []);
  useEffect(() => {
    if (pathname.startsWith('/dashboard') || pathname === '/login' || pathname.startsWith('/auth')) return;
    let alive = true;
    const db = createClient();
    const sync = async (userId: string | null) => {
      if (!alive) return;
      if (account.current !== userId) { account.current = userId; loaded.current = null; setKeys(new Set()); setCounts(new Map()); setReady(false); }
      if (!userId) { setReady(true); return; }
      if (loaded.current !== userId) {
        const res = await fetch('/api/saved', { cache: 'no-store' });
        const data = await res.json();
        if (!alive || account.current !== userId) return;
        if (!res.ok) return;
        loaded.current = userId; setKeys(new Set(data.keys)); setReady(true);
      }
      let intent;
      try { intent = readSaveIntent(JSON.parse(sessionStorage.getItem(SAVE_INTENT_KEY) || 'null')); } catch { return; }
      if (!intent) { sessionStorage.removeItem(SAVE_INTENT_KEY); return; }
      const type = intent.type;
      if (intent.returnTo !== `${window.location.pathname}${window.location.search}`) return;
      sessionStorage.removeItem(SAVE_INTENT_KEY);
      const res = await fetch(scrapEndpoint(type, intent.id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scraped: true }) });
      if (!alive || account.current !== userId) return;
      if (res.ok) { const data=await res.json(); notifySaved(type,intent.id,true,userId,data.scrapCount); update(`${type}:${intent.id}`, true); addToast('로그인 후 자료를 저장했습니다.', 'success'); router.refresh(); }
      else addToast('저장을 완료하지 못했습니다. 저장 버튼으로 다시 시도해주세요.', 'error');
    };
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => { void sync(session?.user.id || null).catch(() => {}); });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [pathname, update, addToast, router]);
  useEffect(() => {
    const changed=(event: Event) => {
      const detail=(event as CustomEvent).detail;
      if (!detail || detail.userId !== account.current || resourceType(detail.type) === 'all' || typeof detail.scraped !== 'boolean') return;
      const key=`${detail.type}:${detail.id}`;
      update(key,detail.scraped);
      if (typeof detail.scrapCount === 'number') setCounts(prev => new Map(prev).set(key,detail.scrapCount));
    };
    window.addEventListener('archb-saved-change',changed);
    return () => window.removeEventListener('archb-saved-change',changed);
  },[update]);
  const toggle = async (type: ResourceType, id: string) => {
    const key = `${type}:${id}`;
    if (pendingRequests.current.has(key)) return;
    if (!account.current) { router.push(saveLoginHref(type, id)); return; }
    const userId = account.current;
    pendingRequests.current.add(key); setBusy(new Set(pendingRequests.current));
    try {
      const res = await fetch(scrapEndpoint(type, id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scraped: !keys.has(key) }) });
      const data = await res.json();
      if (account.current !== userId) return;
      if (res.status === 401) { router.push(saveLoginHref(type, id)); return; }
      if (!res.ok) throw new Error(data.error || '저장에 실패했습니다.');
      notifySaved(type,id,data.scraped,userId,data.scrapCount); update(key, data.scraped); addToast(data.scraped ? '저장했습니다.' : '저장을 취소했습니다.', 'success');
      if (pathname === '/mypage/activity') router.refresh();
    } catch (cause) { addToast(cause instanceof Error ? cause.message : '저장에 실패했습니다.', 'error'); }
    finally { pendingRequests.current.delete(key); setBusy(new Set(pendingRequests.current)); }
  };
  return <SavedContext.Provider value={{ ready, counts, keys, busy, toggle }}>{children}</SavedContext.Provider>;
}
export function SaveButton({ type, id, title, iconOnly = false }: { type: ResourceType; id: string; title: string; iconOnly?: boolean }) {
  const saved = useContext(SavedContext);
  const key = `${type}:${id}`;
  const active = !!saved?.keys.has(key);
  const action = active ? '저장 취소' : '저장';
  return <button type="button" className={iconOnly ? 'archive-bookmark' : 'resource-save'} aria-label={`${title} ${action}`} title={iconOnly ? action : undefined} aria-pressed={active} disabled={!saved?.ready || saved.busy.has(key)} onClick={() => void saved?.toggle(type, id)}><i aria-hidden="true" className={saved?.busy.has(key) ? 'ri-loader-4-line animate-spin' : active ? 'ri-bookmark-fill' : 'ri-bookmark-line'} />{!iconOnly && <span>{active ? '저장됨' : '저장'}</span>}</button>;
}

export function useSavedResource(type: ResourceType, id: string) {
  const saved=useContext(SavedContext);
  return saved?.ready ? saved.keys.has(`${type}:${id}`) : undefined;
}

export function useSavedCount(type: ResourceType,id: string) {
  return useContext(SavedContext)?.counts.get(`${type}:${id}`);
}
