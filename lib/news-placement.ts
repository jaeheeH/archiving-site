import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from './supabase/public';

export const NEWS_PLACEMENT_TAG = 'archb-news-placement';
export const readNewsPlacement = unstable_cache(async () => {
  const { data, error } = await createPublicClient().from('site_settings').select('news_featured_post_id,news_editor_pick_ids').single();
  if (error) throw error;
  return { featuredId: data.news_featured_post_id as string | null, editorPickIds: (data.news_editor_pick_ids || []) as string[] };
}, ['archb-news-placement'], { revalidate: 600, tags: [NEWS_PLACEMENT_TAG] });
