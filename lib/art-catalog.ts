import "server-only";
import { cache } from "react";
import { unstable_cache } from 'next/cache';
import { createPublicClient } from "@/lib/supabase/public";
import artworkData from "@/research/art-collection/artworks.json";
import artistData from "@/research/art-collection/artists.json";
import editorialData from '@/research/art-collection/editorial.json';
import expansionData from '@/research/art-collection/expansion.json';
import type { ArtistProfile } from './art-input';
import taxonomyData from '@/research/art-collection/taxonomy.json';
import type { ArtTaxonomy } from './art-taxonomy';

export type Artwork = {
  id: string;
  museum: string;
  title: string;
  title_ko: string;
  artist: string;
  artist_ids: string[];
  artist_status: "identified" | "unidentified";
  date: string;
  medium: string;
  dimensions: string;
  medium_ko?: string;
  dimensions_ko?: string;
  description?: string;
  culture: string;
  accession: string;
  source_url: string;
  preview_url: string;
  license: string;
  policy_url: string;
  themes: string[];
  taxonomy?: ArtTaxonomy;
  image_width: number;
  image_height: number;
  collected_at: string;
  title_ko_status: string;
  updated_at?: string;
};

export type Artist = {
  id: string;
  name: string;
  name_ko: string | null;
  source_ids: string[];
  artwork_ids: string[];
  profile?: Partial<ArtistProfile>;
  updated_at?: string;
};

export const ART_CATALOG_TAG = 'public-art-catalog';
const initialTaxonomy = new Map(taxonomyData.artworks.map(row => [row.id, row.taxonomy]));
function withTaxonomy(artworks: Artwork[]) {
  // Saved editorial choices take precedence over the initial reviewed catalog.
  return artworks.map(work => ({ ...work, taxonomy: work.taxonomy ?? initialTaxonomy.get(work.id) }));
}
// Editors bypass the shared cache; repeated reads in one render still share a snapshot.
export const getFreshArtCatalog = cache(async () => {
  const db = createPublicClient();
  const [works, people, links] = await Promise.all([
    db.from("artworks").select("id,data,updated_at").order("id"),
    db.from("artists").select("id,name,name_ko,source_ids,profile,updated_at").order("name"),
    db.from("artwork_artists").select("artwork_id,artist_id"),
  ]);
  const errors = [works.error, people.error, links.error].filter(Boolean);
  if (errors.length) {
    if (errors.every(error => error?.code === "PGRST205")) {
      const artworks = [...artworkData.map(work => ({ ...work, ...editorialData.artworks.find(item => item.id === work.id) })), ...expansionData.artworks] as Artwork[];
      const artists = ([...artistData.artists, ...expansionData.artists] as Artist[]).map(artist => ({ ...artist,
        source_ids: (expansionData.artist_source_ids as Record<string, string[]>)[artist.id] || artist.source_ids,
        artwork_ids: artworks.filter(work => work.artist_ids.includes(artist.id)).map(work => work.id),
        profile: editorialData.artists.find(item => item.id === artist.id)?.profile || artist.profile,
      })) as Artist[];
      return { artworks: withTaxonomy(artworks), artists, databaseReady: false };
    }
    throw errors[0];
  }
  // ponytail: a catalog below 1,000 rows fits one read; paginate this catalog when it grows beyond that ceiling.
  const artworks = (works.data || []).map(row => ({ ...row.data, id: row.id, updated_at: row.updated_at, artist_ids: (links.data || []).filter(link => link.artwork_id === row.id).map(link => link.artist_id) })) as Artwork[];
  const artists = (people.data || []).map(row => ({ ...row, artwork_ids: (links.data || []).filter(link => link.artist_id === row.id).map(link => link.artwork_id) })) as Artist[];
  return { artworks: withTaxonomy(artworks), artists, databaseReady: true };
});
export const getArtCatalog = unstable_cache(getFreshArtCatalog, ['art-catalog-v4'], { revalidate: 600, tags: [ART_CATALOG_TAG] });

export async function getArtwork(id: string) { return (await getArtCatalog()).artworks.find(work => work.id === id); }
export async function getArtist(id: string) { return (await getArtCatalog()).artists.find(artist => artist.id === id); }
export async function getArtworksByArtist(id: string) { return (await getArtCatalog()).artworks.filter(work => work.artist_ids.includes(id)); }
export async function getArtworkArtist(artwork: Artwork) { return artwork.artist_ids.length ? getArtist(artwork.artist_ids[0]) : undefined; }
