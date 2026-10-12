import 'server-only';
import { createClient } from './supabase/server';
import { resourceType, type Resource } from './resource';
import { searchTokens, queryText } from './search-text';
import { cache } from 'react';
import { RESOURCE_LABELS } from './resource';
const getSavedContext = cache(async () => { const db = await createClient(); const { data: { user } } = await db.auth.getUser(); return { db, user }; });
export async function getSavedCounts() {
  const { db, user } = await getSavedContext();
  if (!user) return null;
  const entries = await Promise.all(Object.keys(RESOURCE_LABELS).map(async type => {
    const { count, error } = await db.from('user_saved_items').select('item_id', { count:'exact',head:true }).eq('user_id',user.id).eq('kind',type);
    if (error) throw error;
    return [type,count || 0] as const;
  }));
  return Object.fromEntries(entries);
}

export type SavedRow = { kind: Resource['type']; item_id: string; title: string; description: string; url: string; image: string | null; source: string; tags: string[]; saved_at: string };
export type SavedPage = { items: Resource[]; q: string; type: ReturnType<typeof resourceType>; page: number; total: number; totalPages: number };
export async function getSavedPage(filters: { q?: string | string[]; type?: string | string[]; page?: string | string[] | number }): Promise<SavedPage | null> {
  const { db, user } = await getSavedContext();
  if (!user) return null;
  const q = queryText(filters.q).slice(0, 100).trim();
  const type = resourceType(queryText(filters.type) === 'blog' ? 'post' : filters.type);
  const query = () => {
    let result = db.from('user_saved_items').select('kind,item_id,title,description,url,image,source,tags,saved_at', { count: 'exact' }).eq('user_id', user.id);
    if (type !== 'all') result = result.eq('kind', type);
    for (const token of searchTokens(q)) result = result.ilike('search_text', `%${token.replace(/[\\%_]/g, '\\$&')}%`);
    return result.order('saved_at', { ascending: false }).order('kind').order('item_id');
  };
  let page = Math.min(10000, Math.max(1, Number.parseInt(queryText(filters.page), 10) || 1));
  let result = await query().range((page - 1) * 24, page * 24 - 1);
  if (result.error) throw result.error;
  const total = result.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / 24));
  if (page > totalPages) { page = totalPages; result = await query().range((page - 1) * 24, page * 24 - 1); if (result.error) throw result.error; }
  return { items: (result.data as SavedRow[] || []).map(row => ({ type: row.kind, id: row.item_id, title: row.title, description: row.description, url: row.url, image: row.image, source: row.source, tags: row.tags, searchText: '', date: row.saved_at })), q, type, page, total, totalPages };
}
