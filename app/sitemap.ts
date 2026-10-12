import type { MetadataRoute } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { getArtCatalog } from '@/lib/art-catalog';
import { CATEGORIES } from '@/lib/news-feeds';
import { sitePageUrl } from '@/lib/seo';

export const dynamic = 'force-static';
export const revalidate = 3600;
const lastModified = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value) : undefined;
const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createPublicClient();
  const { artists, artworks } = await getArtCatalog();
  const pages: MetadataRoute.Sitemap = ['/', '/news/stories', '/art', '/artists', '/references', '/gallery', '/privacy', '/terms', ...Object.keys(CATEGORIES).map(category => `/news/stories?category=${category}`)].map(path => ({ url: sitePageUrl(path) }));
  pages.push(...artworks.map(work => ({ url: sitePageUrl(`/art/${work.id}`), lastModified: lastModified(work.updated_at || work.collected_at), images: [sitePageUrl(work.preview_url)] })));
  pages.push(...artists.map(artist => ({ url: sitePageUrl(`/artists/${artist.id}`), lastModified: lastModified(artist.updated_at) })));
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('gallery').select('id,image_url').order('id').range(offset, offset + 999);
    if (error) throw error;
    pages.push(...data.map(item => ({ url: sitePageUrl(`/gallery/${item.id}`), ...(item.image_url ? { images: [sitePageUrl(item.image_url)] } : {}) })));
    if (data.length < 1000) break;
  }
  // Bound UUID filters so PostgREST request URLs stay below HTTP header limits.
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.from('published_post_summaries').select('id,slug,title_image_url').order('id').range(offset, offset + 99);
    if (error) throw error;
    if (data.length) {
      const { data: posts, error: datesError } = await db.from('posts').select('id,updated_at').in('id', data.map(item => item.id)).eq('is_published', true).not('published_at', 'is', null);
      if (datesError) throw datesError;
      const dates = new Map(posts.map(post => [post.id, post.updated_at]));
      pages.push(...data.filter(item => item.slug && dates.has(item.id)).map(item => ({ url: sitePageUrl(`/news/read/${encodeURIComponent(item.slug)}`), lastModified: lastModified(dates.get(item.id)), ...(item.title_image_url ? { images: [sitePageUrl(item.title_image_url)] } : {}) })));
    }
    if (data.length < 100) break;
  }
  if (pages.length > 50000) throw new Error('Sitemap exceeds 50,000 URLs; split into sitemap files before adding more content.');
  // ponytail: Next 16 inserts URLs verbatim; drop pre-escaping when its serializer handles XML.
  return pages.map(page => ({ ...page, url: escapeXml(page.url), ...(page.images ? { images: page.images.map(escapeXml) } : {}) }));
}
