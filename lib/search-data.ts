import 'server-only';
import { getArtCatalog } from './art-catalog';
import { readNewsSummaries } from './news';
import { getReferencesPageData } from './public-data';
import { readGallerySearch } from './gallery-search-data';
import type { Resource } from './resource';


export async function getSearchResources(): Promise<Resource[]> {
  const [news, catalog, references, gallery] = await Promise.all([readNewsSummaries(), getArtCatalog(), getReferencesPageData(), readGallerySearch()]);
  return [
    ...news.articles.map<Resource>(a => ({ type: 'post', id: a.id, title: a.title, description: a.description, url: `/news/read/${a.slug}`, image: a.image || null, source: a.source, tags: a.tags, searchText: `${a.original_title} ${a.category}`, date: a.published_at })),
    ...catalog.artworks.map<Resource>(a => ({ type: 'artwork', id: a.id, title: a.title_ko || a.title, description: [a.artist_ids.map(id => { const artist = catalog.artists.find(p => p.id === id); return artist?.name_ko || artist?.name; }).join(' · '), a.date, a.medium_ko || a.medium].filter(Boolean).join(' · '), url: `/art/${a.id}`, image: a.preview_url, source: a.museum, tags: a.themes, searchText: [a.title, a.artist, a.description, a.medium, a.medium_ko, ...a.artist_ids.flatMap(id => { const artist = catalog.artists.find(p => p.id === id); return [artist?.name, artist?.name_ko]; })].filter(Boolean).join(' ') })),
    ...catalog.artists.map<Resource>(a => ({ type: 'artist', id: a.id, title: a.name_ko || a.name, description: a.profile?.description || a.name, url: `/artists/${a.id}`, image: catalog.artworks.find(w => w.artist_ids.includes(a.id))?.preview_url || null, source: 'ARCH.B 작가 아카이브', tags: a.profile?.context ? [a.profile.context] : [], searchText: `${a.name} ${a.profile?.lifespan || ''}` })),
    ...references.references.map<Resource>(a => ({ type: 'reference', id: String(a.id), title: a.title, description: a.description || '', url: a.url, image: a.image_url || a.logo_url, source: a.url, tags: [a.category, ...(a.range || [])].filter(Boolean) as string[], searchText: a.url, date: a.created_at })),
    ...gallery,
  ];
}
export { searchPage } from './resource-search';
