import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from './supabase/public';
import type { Resource } from './resource';
export const readGallerySearch = unstable_cache(async () => {
  const items: Resource[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await createPublicClient().from('gallery').select('id,title,description,gemini_description,tags,gemini_tags,image_url,thumbnail_url,created_at').order('id').range(start, start + 499);
    if (error) throw error;
    for (const row of data || []) items.push({ type: 'gallery', id: String(row.id), title: row.title || '이미지', description: row.description || row.gemini_description || '', source: 'ARCH.B 갤러리', url: `/gallery/${row.id}`, image: row.thumbnail_url || row.image_url, tags: [...(row.tags || []), ...(row.gemini_tags || [])], searchText: row.gemini_description || '', date: row.created_at });
    if (!data || data.length < 500) break;
  }
  return items;
}, ['gallery-search-metadata'], { revalidate: 600, tags: ['public-gallery'] });
