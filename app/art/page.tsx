import { matchesSearch } from '@/lib/search-text';
import { artFilterOptions, artTaxonomyTags, hasArtFilters, matchesArtFilters, readArtFilters } from '@/lib/art-taxonomy';
import { artListHref, artListPage, type ArtListParams } from '@/lib/art-list';
import ArtFilters from '@/app/components/ArtFilters';
import Link from "next/link";
import ArtworkCard from "./ArtworkCard";
import ArtworkLoadMore from './ArtworkLoadMore';
import ArchiveMasonry from '@/app/components/ArchiveMasonry';
import { getArtCatalog } from "@/lib/art-catalog";
import { getPageMetadata } from '@/lib/site-settings';

export async function generateMetadata({ searchParams }: ArtPageProps) {
  return getPageMetadata({ path: '/art', title: '아트 · 작품 아카이브', description: '출처와 이용 근거를 확인한 실제 작품을 시대, 사조, 작품 종류, 주제별로 탐색합니다.', noindex: hasArtFilters(readArtFilters(await searchParams)) });
}

type ArtPageProps = {
  searchParams: Promise<ArtListParams>;
};

export default async function ArtPage({ searchParams }: ArtPageProps) {
  const { artists, artworks } = await getArtCatalog();
  const params = await searchParams;
  const filters = readArtFilters(params);
  const { q } = filters;
  const museums = [...new Set(artworks.map((artwork) => artwork.museum))].sort();
  const filteredArtworks = artworks.filter((artwork) => {
    const names = artwork.artist_ids.flatMap(id => { const person = artists.find(a => a.id === id); return [person?.name,person?.name_ko]; });
    return matchesSearch(q, [artwork.title_ko,artwork.title,artwork.artist,artwork.description,artwork.medium,artwork.medium_ko,...artwork.themes,...names,...artTaxonomyTags(artwork.taxonomy).map(tag => tag.label)]) && matchesArtFilters(artwork, filters);
  });
  const pagination = artListPage(filteredArtworks.length, params);
  const returnTo = artListHref(params, pagination.page);

  return (
    <main className="archb-archive archive-art-page" data-analytics-query={q} data-analytics-results={filteredArtworks.length} data-analytics-scope={JSON.stringify(filters)}>
      <header className="archive-heading">
        <span className="archive-kicker">작품으로 넓히는 시선</span>
        <h1>아트</h1>
        <p>시대와 사조에서 시작해 작품 종류와 주제를 따라 탐색합니다.</p>
      </header>

      <ArtFilters action="/art" filters={filters} options={artFilterOptions(artworks)} artists={artists.map(item => ({ id: item.id, label: item.name_ko || item.name }))} museums={museums} />

      <div className="archive-caption">
        <p>{q ? `“${q}” 검색 결과 · ` : '수집한 작품 · '}<strong>{filteredArtworks.length}</strong>점</p>
        {hasArtFilters(filters) ? <Link href="/art">조건 초기화</Link> : <Link href="/artists">작가 {artists.length}명 보기 →</Link>}
      </div>

      {filteredArtworks.length ? (
        <>
          <ArchiveMasonry label="작품 목록" id="artwork-list">
            {filteredArtworks.slice(0, pagination.shown).map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} returnTo={returnTo} />)}
          </ArchiveMasonry>
          <ArtworkLoadMore {...pagination} total={filteredArtworks.length} />
        </>
      ) : (
        <div className="archive-empty">조건에 맞는 작품이 없습니다.</div>
      )}
      <p className="archive-note">작품의 정보와 원출처, 이용 근거는 상세 화면에서 확인할 수 있습니다.</p>
    </main>
  );
}
