import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import artworkData from "@/research/art-collection/artworks.json";
import artistData from "@/research/art-collection/artists.json";

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
  culture: string;
  accession: string;
  source_url: string;
  preview_url: string;
  license: string;
  policy_url: string;
  themes: string[];
  image_width: number;
  image_height: number;
  collected_at: string;
  title_ko_status: string;
};

export type Artist = {
  id: string;
  name: string;
  name_ko: string | null;
  source_ids: string[];
  artwork_ids: string[];
};

export const ART_CACHE_TAG = "archb-art-catalog";
export const getArtCatalog = unstable_cache(async () => {
  const db = createPublicClient();
  const [works, people, links] = await Promise.all([
    db.from("artworks").select("id,data,updated_at").order("id"),
    db.from("artists").select("id,name,name_ko,source_ids,updated_at").order("name"),
    db.from("artwork_artists").select("artwork_id,artist_id"),
  ]);
  const errors = [works.error, people.error, links.error].filter(Boolean);
  if (errors.length) {
    if (errors.every(error => error?.code === "PGRST205")) return { artworks: artworkData as Artwork[], artists: artistData.artists as Artist[], databaseReady: false };
    throw errors[0];
  }
  // ponytail: a catalog below 1,000 rows fits one read; paginate this catalog when it grows beyond that ceiling.
  const artworks = (works.data || []).map(row => ({ ...row.data, id: row.id, updated_at: row.updated_at, artist_ids: (links.data || []).filter(link => link.artwork_id === row.id).map(link => link.artist_id) })) as Artwork[];
  const artists = (people.data || []).map(row => ({ ...row, artwork_ids: (links.data || []).filter(link => link.artist_id === row.id).map(link => link.artwork_id) })) as Artist[];
  return { artworks, artists, databaseReady: true };
}, ["archb-art-catalog"], { revalidate: 600, tags: [ART_CACHE_TAG] });

export async function getArtwork(id: string) { return (await getArtCatalog()).artworks.find(work => work.id === id); }
export async function getArtist(id: string) { return (await getArtCatalog()).artists.find(artist => artist.id === id); }
export async function getArtworksByArtist(id: string) { return (await getArtCatalog()).artworks.filter(work => work.artist_ids.includes(id)); }
export async function getArtworkArtist(artwork: Artwork) { return artwork.artist_ids.length ? getArtist(artwork.artist_ids[0]) : undefined; }
