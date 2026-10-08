import { getPageMetadata } from '@/lib/site-settings';
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArtworkCard from "@/app/art/ArtworkCard";
import { getArtCatalog, getArtist, getArtworksByArtist } from "@/lib/art-catalog";
import { jsonLd, breadcrumb, sitePageUrl } from '@/lib/seo';

type ArtistPageProps = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  return (await getArtCatalog()).artists.map(({ id }) => ({ id }));
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const artist = await getArtist((await params).id);
  if (!artist) notFound();
  const works = await getArtworksByArtist(artist.id);
  return getPageMetadata({ path: `/artists/${artist.id}`, title: `${artist.name_ko || artist.name} · 작가`, description: `${artist.name}의 수집 작품 ${works.length}점을 소장 기관과 시기별로 살펴봅니다. 작품 상세 정보와 원출처를 함께 확인합니다.`, image: works[0]?.preview_url });
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const artist = await getArtist((await params).id);
  if (!artist) notFound();

  const artistArtworks = await getArtworksByArtist(artist.id);
  const museums = [...new Set(artistArtworks.map((artwork) => artwork.museum))];

  return (
    <main className="archb-archive archive-detail">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumb([{ name: '홈', path: '/' }, { name: '작가', path: '/artists' }, { name: artist.name_ko || artist.name, path: `/artists/${artist.id}` }]),
        { '@context': 'https://schema.org', '@type': 'ProfilePage', '@id': sitePageUrl(`/artists/${artist.id}`), mainEntity: { '@type': 'Person', name: artist.name_ko || artist.name, alternateName: artist.name, url: sitePageUrl(`/artists/${artist.id}`) } },
      ]) }} />
      <nav className="archive-breadcrumb" aria-label="현재 위치">
        <Link href="/artists" className="hover:text-foreground">작가</Link><span aria-hidden="true">/</span><span>{artist.name_ko || artist.name}</span>
      </nav>
      <header className="archive-heading archive-artist-heading">
        <div>
          <span className="archive-kicker">작가 아카이브</span>
          <h1>{artist.name_ko || artist.name}</h1>
          {artist.name_ko && <p>{artist.name}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <dt className="text-muted-foreground">수집 작품</dt><dd className="text-right font-semibold">{artistArtworks.length}점</dd>
          <dt className="text-muted-foreground">확인 기관</dt><dd className="text-right font-semibold">{museums.length}곳</dd>
        </dl>
      </header>

      <div className="archive-note">
        <strong className="text-foreground">현재 수집 범위</strong> · {museums.join(" · ")}. 이 페이지의 수량은 해당 작가의 전작이 아니라 ARCH.B가 확인한 표본입니다.
      </div>

      <section aria-label={`${artist.name_ko || artist.name} 작품 목록`} className="archive-grid">
        {artistArtworks.map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} />)}
      </section>
    </main>
  );
}
