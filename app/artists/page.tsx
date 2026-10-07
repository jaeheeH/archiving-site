import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getArtCatalog } from "@/lib/art-catalog";

export const metadata: Metadata = {
  title: "작가",
  description: "여러 기관의 작품을 같은 작가별로 연결해 탐색합니다.",
};

type ArtistsPageProps = { searchParams: Promise<{ q?: string }> };

export default async function ArtistsPage({ searchParams }: ArtistsPageProps) {
  const { artists, artworks } = await getArtCatalog();
  const { q = "" } = await searchParams;
  const query = q.trim().toLocaleLowerCase("ko");
  const filteredArtists = artists
    .filter((artist) => !query || `${artist.name_ko || ""} ${artist.name}`.toLocaleLowerCase("ko").includes(query))
    .sort((a, b) => (a.name_ko || a.name).localeCompare(b.name_ko || b.name, "ko"));

  return (
    <main className="archb-archive archive-artists-page">
      <header className="archive-heading">
        <span className="archive-kicker">만드는 사람을 따라</span>
        <h1>작가</h1>
        <p>작가의 이름에서 출발해 서로 다른 기관에 소장된 작품을 이어 봅니다.</p>
      </header>

      <div className="archive-caption border-t border-border"><p>{q ? `“${q}” 검색 결과 · ` : '함께 보는 작가 · '}<strong>{filteredArtists.length}</strong>명</p>{q ? <Link href="/artists">검색 초기화</Link> : <Link href="/art">전체 작품 보기 →</Link>}</div>
      {!filteredArtists.length && <div className="archive-empty">검색 결과가 없습니다. 한글 또는 원문 이름으로 찾아보세요.</div>}
      <section aria-label="작가 목록" className="archive-grid">
        {filteredArtists.map((artist) => {
          const artistArtworks = artworks.filter(work => work.artist_ids.includes(artist.id));
          const museums = new Set(artistArtworks.map((artwork) => artwork.museum));
          const cover = artistArtworks[0];
          return (
            <article key={artist.id} className="archive-card archive-artist-card group"><Link href={`/artists/${artist.id}`}>
              <div className="archive-media">
                {cover && <Image unoptimized src={cover.preview_url} alt={`${artist.name_ko || artist.name} 대표 작품`} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-contain p-4 transition-transform duration-500 group-hover:scale-[1.025]" />}
              </div>
              <div className="archive-card-copy">
                <p className="archive-card-label">작품 {artistArtworks.length}점 · {museums.size}개 기관</p>
                <h2>{artist.name_ko || artist.name}</h2>
                {artist.name_ko && <p className="archive-card-description">{artist.name}</p>}
              </div>
            </Link></article>
          );
        })}
      </section>
      <p className="archive-note">등록 작품 수는 작가의 전작이 아니라, ARCH.B가 확인한 현재 아카이브의 수집 범위입니다.</p>
    </main>
  );
}
