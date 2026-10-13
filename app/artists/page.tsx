import { matchesSearch } from '@/lib/search-text';
import { artFilterOptions, artTaxonomyTags, hasArtFilters, matchesArtFilters, readArtFilters, type ArtFilterParams } from '@/lib/art-taxonomy';
import ArtFilters from '@/app/components/ArtFilters';
import ArtworkTags from '@/app/components/ArtworkTags';
import { SaveButton } from '@/app/components/SavedProvider';
import ArchiveMasonry from '@/app/components/ArchiveMasonry';
import Link from "next/link";
import Image from "@/app/components/ArchiveImage";
import type { CSSProperties } from "react";
import { getArtCatalog } from "@/lib/art-catalog";
import { getPageMetadata } from '@/lib/site-settings';

export async function generateMetadata({ searchParams }: ArtistsPageProps) {
  return getPageMetadata({ path: '/artists', title: '작가 아카이브', description: '여러 기관의 작품을 같은 작가별로 연결해 시대, 사조, 주제로 탐색합니다.', noindex: hasArtFilters(readArtFilters(await searchParams)) });
}

type ArtistsPageProps = { searchParams: Promise<ArtFilterParams> };

export default async function ArtistsPage({ searchParams }: ArtistsPageProps) {
  const { artists, artworks } = await getArtCatalog();
  const filters = readArtFilters(await searchParams);
  const { q } = filters;
  const hasWorkFilters = hasArtFilters({ ...filters, q: '' });
  const matchingWorks = artworks.filter(work => matchesArtFilters(work, filters));
  const museums = [...new Set(artworks.map(work => work.museum))].sort();
  const filteredArtists = artists
    .filter(artist => (!hasWorkFilters || matchingWorks.some(work => work.artist_ids.includes(artist.id))) && matchesSearch(q, [artist.name_ko, artist.name, artist.profile?.description, artist.profile?.context, ...artworks.filter(work => work.artist_ids.includes(artist.id)).flatMap(work => artTaxonomyTags(work.taxonomy).map(tag => tag.label))]))
    .sort((a, b) => (a.name_ko || a.name).localeCompare(b.name_ko || b.name, "ko"));

  return (
    <main className="archb-archive archive-artists-page">
      <header className="archive-heading">
        <span className="archive-kicker">만드는 사람을 따라</span>
        <h1>작가</h1>
        <p>작가의 이름에서 출발해 서로 다른 기관에 소장된 작품을 이어 봅니다.</p>
      </header>

      <ArtFilters action="/artists" filters={filters} options={artFilterOptions(artworks)} museums={museums} forArtists />
      <div className="archive-caption"><p>{q ? `“${q}” 검색 결과 · ` : '함께 보는 작가 · '}<strong>{filteredArtists.length}</strong>명</p>{hasArtFilters(filters) ? <Link href="/artists">조건 초기화</Link> : <Link href="/art">전체 작품 보기 →</Link>}</div>
      {!filteredArtists.length && <div className="archive-empty">검색 결과가 없습니다. 한글 또는 원문 이름으로 찾아보세요.</div>}
      <ArchiveMasonry label="작가 목록">
        {filteredArtists.map((artist) => {
          const artistArtworks = artworks.filter(work => work.artist_ids.includes(artist.id));
          const museums = new Set(artistArtworks.map((artwork) => artwork.museum));
          const selectedWorks = matchingWorks.filter(work => work.artist_ids.includes(artist.id));
          const cover = selectedWorks[0] || artistArtworks[0];
          return (
            <article key={artist.id} className="archive-card archive-artist-card group">
              <Link href={`/artists/${artist.id}`} className="archive-media" style={{ "--archive-image-ratio": cover && cover.image_width > 0 && cover.image_height > 0 ? `${cover.image_width} / ${cover.image_height}` : "1.65" } as CSSProperties}>
                {cover && <Image src={cover.preview_url} alt={`${cover.title_ko} — ${artist.name_ko || artist.name}`} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-contain" />}
              </Link>
              <div className="archive-card-copy">
                <p className="archive-card-label">{hasWorkFilters ? `조건 일치 ${selectedWorks.length}점 · 전체 ${artistArtworks.length}점` : `작품 ${artistArtworks.length}점 · ${museums.size}개 기관`}</p>
                <div className="archive-card-title-row">
                  <h2><Link href={`/artists/${artist.id}`}>{artist.name_ko || artist.name}</Link></h2>
                  <SaveButton type="artist" id={artist.id} title={artist.name_ko || artist.name} iconOnly />
                </div>
                {artist.name_ko && <p className="archive-card-description">{artist.name}</p>}
                {artist.profile?.context && <p className="archive-card-meta mt-3">{[artist.profile.lifespan, artist.profile.context].filter(Boolean).join(' · ')}</p>}
                {artist.profile?.description && <p className="archive-card-description line-clamp-2 mt-3">{artist.profile.description}</p>}
                <ArtworkTags taxonomy={(hasWorkFilters ? selectedWorks : artistArtworks).flatMap(work => work.taxonomy ? [work.taxonomy] : [])} groups={['subject']} artist={artist.id} />
              </div>
            </article>
          );
        })}
      </ArchiveMasonry>
      <p className="archive-note">등록 작품 수는 작가의 전작이 아니라, ARCH.B가 확인한 현재 아카이브의 수집 범위입니다.</p>
    </main>
  );
}
