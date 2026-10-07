import type { MetadataRoute } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { getArtCatalog } from '@/lib/art-catalog';
import { CATEGORIES } from '@/lib/news-feeds';
import { sitePageUrl } from '@/lib/seo';

export const dynamic = 'force-static';
export const revalidate = 3600;
const lastModified = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value) : undefined;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createPublicClient();
  const { artists, artworks } = await getArtCatalog();
  const pages: MetadataRoute.Sitemap = ['/', '/news/stories', '/art', '/artists', '/references', '/gallery', '/privacy', '/terms', ...Object.keys(CATEGORIES).map(category => `/news/stories?category=${category}`)].map(path => ({ url: sitePageUrl(path) }));
  pages.push(...artworks.map(work => ({ url: sitePageUrl(`/art/${work.id}`), lastModified: lastModified(work.updated_at || work.collected_at) })));
  pages.push(...artists.map(artist => ({ url: sitePageUrl(`/artists/${artist.id}`), lastModified: lastModified(artist.updated_at) })));
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('gallery').select('id').order('id').range(offset, offset + 999);
    if (error) throw error;
    pages.push(...data.map(item => ({ url: sitePageUrl(`/gallery/${item.id}`) })));
    if (data.length < 1000) break;
  }
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('posts').select('slug,type,content,updated_at').in('type', ['blog', 'news']).eq('is_published', true).not('published_at', 'is', null).order('id').range(offset, offset + 999);
    if (error) throw error;
    pages.push(...data.filter(item => item.slug && (item.type === 'blog' || (item.content?.format === 'archb-news-v1' && Object.hasOwn(CATEGORIES, item.content.category) && Array.isArray(item.content.paragraphs) && Array.isArray(item.content.points)))).map(item => ({ url: sitePageUrl(`/news/read/${encodeURIComponent(item.slug)}`), lastModified: lastModified(item.updated_at) })));
    if (data.length < 1000) break;
  }
  if (pages.length > 50000) throw new Error('Sitemap exceeds 50,000 URLs; split into sitemap files before adding more content.');
  return pages;
}
