import { getPageMetadata } from '@/lib/site-settings';
import type { Metadata } from "next";
import Link from "next/link";
import Image from "@/app/components/ArchiveImage";
import { notFound } from "next/navigation";
import ArtworkCard from "../ArtworkCard";
import { getArtCatalog, getArtwork, getArtworkArtist, getArtworksByArtist } from "@/lib/art-catalog";
import { jsonLd, breadcrumb, sitePageUrl } from '@/lib/seo';

type ArtworkPageProps = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  return (await getArtCatalog()).artworks.map(({ id }) => ({ id }));
}

export async function generateMetadata({ params }: ArtworkPageProps): Promise<Metadata> {
  const artwork = await getArtwork((await params).id);
  if (!artwork) notFound();
  return getPageMetadata({ path: `/art/${artwork.id}`, title: `${artwork.title_ko} · ${artwork.artist}`, description: `${artwork.artist}의 ${artwork.title}. ${artwork.date}, ${artwork.medium}. ${artwork.museum} 소장. 작품 정보와 원출처를 살펴봅니다.`, image: artwork.preview_url });
}

export default async function ArtworkPage({ params }: ArtworkPageProps) {
  const artwork = await getArtwork((await params).id);
  if (!artwork) notFound();

  const artist = await getArtworkArtist(artwork);
  const related = artist
    ? (await getArtworksByArtist(artist.id)).filter((item) => item.id !== artwork.id).slice(0, 4)
    : [];

  return (
    <main className="archb-archive archive-detail">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumb([{ name: '홈', path: '/' }, { name: '아트', path: '/art' }, { name: artwork.title_ko, path: `/art/${artwork.id}` }]),
        { '@context': 'https://schema.org', '@type': 'VisualArtwork', '@id': sitePageUrl(`/art/${artwork.id}#artwork`), url: sitePageUrl(`/art/${artwork.id}`), name: artwork.title_ko, alternateName: artwork.title, image: artwork.preview_url, artMedium: artwork.medium, ...(artist ? { creator: { '@type': 'Person', name: artist.name_ko || artist.name, url: sitePageUrl(`/artists/${artist.id}`) } } : {}), isBasedOn: artwork.source_url },
      ]) }} />
      <nav className="archive-breadcrumb" aria-label="현재 위치">
        <Link href="/art" className="hover:text-foreground">아트</Link>
        <span aria-hidden="true">/</span>
        <span>{artwork.title_ko}</span>
      </nav>

      <article className="archive-artwork-layout">
        <div className="archive-artwork-media">
          <Image

            src={artwork.preview_url}
            alt={`${artwork.title_ko} — ${artist?.name_ko || artwork.artist}`}
            width={artwork.image_width}
            height={artwork.image_height}
            sizes="(max-width: 1024px) 100vw, 70vw"
            className="max-h-[82vh] w-auto max-w-full object-contain"
          />
        </div>

        <div className="archive-artwork-info">
          <p className="archive-kicker">{artwork.museum}</p>
          <h1>{artwork.title_ko}</h1>
          <p className="mt-3 text-base italic text-muted-foreground">{artwork.title}</p>

          <div className="mt-7 border-y border-border py-5">
            {artist ? (
              <Link href={`/artists/${artist.id}`} className="text-lg font-semibold hover:underline">
                {artist.name_ko || artist.name} <span className="font-normal text-muted-foreground">{artist.name}</span>
              </Link>
            ) : (
              <p className="text-lg font-semibold">작가 미상</p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">{artwork.date}</p>
          </div>

          <dl className="grid grid-cols-[88px_1fr] gap-x-4 gap-y-4 py-6 text-sm leading-6">
            <dt className="text-muted-foreground">재료·기법</dt><dd>{artwork.medium || "미확인"}</dd>
            <dt className="text-muted-foreground">크기</dt><dd>{artwork.dimensions || "미확인"}</dd>
            <dt className="text-muted-foreground">소장처</dt><dd>{artwork.museum}</dd>
            <dt className="text-muted-foreground">소장품 번호</dt><dd>{artwork.accession}</dd>
            <dt className="text-muted-foreground">이용 표시</dt><dd>{artwork.license}</dd>
            <dt className="text-muted-foreground">수집일</dt><dd>{artwork.collected_at.slice(0, 10)}</dd>
          </dl>

          <p className="border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
            한국어 제목은 작업용 번역이며 원문 제목을 기준 정보로 보존합니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={artwork.source_url} target="_blank" rel="noopener noreferrer" className="archive-button">
              원출처 보기 <i className="ri-external-link-line" aria-hidden="true" />
            </a>
            <a href={artwork.policy_url} target="_blank" rel="noopener noreferrer" className="archive-button archive-button-secondary">
              이용 정책
            </a>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="archive-section" aria-labelledby="related-artworks">
          <div className="archive-section-heading">
            <h2 id="related-artworks">이 작가의 다른 작품</h2>
            <Link href={`/artists/${artist?.id}`} className="text-sm font-semibold hover:underline">작가 아카이브</Link>
          </div>
          <div className="archive-grid">
            {related.map((item) => <ArtworkCard key={item.id} artwork={item} />)}
          </div>
        </section>
      )}
    </main>
  );
}
