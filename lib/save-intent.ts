import { resourceType, type ResourceType } from './resource';
export const SAVE_INTENT_KEY = 'archb-save-intent';
export function readSaveIntent(value: unknown, now = Date.now()) {
  if (!value || typeof value !== 'object') return null;
  const intent=value as Record<string,unknown>;
  if (typeof intent.type !== 'string' || typeof intent.id !== 'string' || !intent.id || intent.id.length > 100 || typeof intent.returnTo !== 'string' || !/^\/(?!\/)/.test(intent.returnTo) || typeof intent.createdAt !== 'number' || !Number.isFinite(intent.createdAt) || intent.createdAt > now || now-intent.createdAt > 10*60_000) return null;
  const type=resourceType(intent.type);
  return type === 'all' ? null : {type,id:intent.id,returnTo:intent.returnTo,createdAt:intent.createdAt};
}
export function saveLoginHref(type: ResourceType, id: string) {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  try { sessionStorage.setItem(SAVE_INTENT_KEY, JSON.stringify({ type, id, returnTo, createdAt: Date.now() })); } catch { /* ponytail: Blocked browser storage prevents save resumption; manual save still works. */ }
  return `/login?redirect=${encodeURIComponent(returnTo)}`;
}
export function scrapEndpoint(type: ResourceType, id: string) {
  const segments = { post: 'posts', artwork: 'artworks', artist: 'artists', reference: 'references', gallery: 'gallery' };
  return `/api/${segments[type]}/${encodeURIComponent(id)}/scrap`;
}

export function notifySaved(type: ResourceType, id: string, scraped: boolean, userId: string, scrapCount?: number) {
  window.dispatchEvent(new CustomEvent('archb-saved-change', { detail:{type,id,scraped,userId,scrapCount} }));
}
