import type { Metadata } from "next";
import Link from "next/link";
import ArtworkCard from "./ArtworkCard";
import { getArtCatalog } from "@/lib/art-catalog";

export const metadata: Metadata = {
  title: "아트",
  description: "출처와 이용 근거를 확인한 실제 작품을 작가, 시기, 소장처별로 탐색합니다.",
};

type ArtPageProps = {
  searchParams: Promise<{ q?: string; artist?: string; museum?: string }>;
};

export default async function ArtPage({ searchParams }: ArtPageProps) {
  const { artists, artworks } = await getArtCatalog();
  const { q = "", artist = "", museum = "" } = await searchParams;
  const query = q.trim().toLocaleLowerCase("ko");
  const museums = [...new Set(artworks.map((artwork) => artwork.museum))].sort();
  const filteredArtworks = artworks.filter((artwork) => {
    const searchable = [artwork.title_ko, artwork.title, artwork.artist, artwork.medium]
      .join(" ")
      .toLocaleLowerCase("ko");

    return (
      (!query || searchable.includes(query)) &&
      (!artist || artwork.artist_ids.includes(artist)) &&
      (!museum || artwork.museum === museum)
    );
  });

  return (
    <main className="archb-archive archive-art-page">
      <header className="archive-heading">
        <span className="archive-kicker">작품으로 넓히는 시선</span>
        <h1>아트</h1>
        <p>실제 작품과 원출처를 함께 살펴보고, 작가와 소장처를 따라 탐색합니다.</p>
      </header>

      <form className="archive-controls" action="/art" aria-label="작품 필터">
        {q && <input type="hidden" name="q" value={q} />}
        <label className="sr-only" htmlFor="artist-filter">작가</label>
        <select id="artist-filter" name="artist" defaultValue={artist}>
          <option value="">모든 작가</option>
          {artists.map((item) => (
            <option key={item.id} value={item.id}>{item.name_ko || item.name}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="museum-filter">소장처</label>
        <select id="museum-filter" name="museum" defaultValue={museum}>
          <option value="">모든 소장처</option>
          {museums.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button className="archive-button">필터 적용</button>
      </form>

      <div className="archive-caption">
        <p>{q ? `“${q}” 검색 결과 · ` : '수집한 작품 · '}<strong>{filteredArtworks.length}</strong>점</p>
        {(q || artist || museum) ? <Link href="/art">조건 초기화</Link> : <Link href="/artists">작가 {artists.length}명 보기 →</Link>}
      </div>

      {filteredArtworks.length ? (
        <section aria-label="작품 목록" className="archive-grid">
          {filteredArtworks.map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} />)}
        </section>
      ) : (
        <div className="archive-empty">조건에 맞는 작품이 없습니다.</div>
      )}
      <p className="archive-note">작품의 정보와 원출처, 이용 근거는 상세 화면에서 확인할 수 있습니다.</p>
    </main>
  );
}
