import { SaveButton } from '@/app/components/SavedProvider';
import { getPageMetadata } from '@/lib/site-settings';
import type { Metadata } from "next";
import Link from "next/link";
import Image from "@/app/components/ArchiveImage";
import { notFound } from "next/navigation";
import ArtworkCard from "../ArtworkCard";
import ArchiveMasonry from '@/app/components/ArchiveMasonry';
import { getArtCatalog, getArtwork, getArtworkArtist, getArtworksByArtist } from "@/lib/art-catalog";
import { jsonLd, breadcrumb, sitePageUrl } from '@/lib/seo';
import ArtworkTags from '@/app/components/ArtworkTags';
import { Suspense } from 'react';
import ArtworkBackLink from '../ArtworkBackLink';

type ArtworkPageProps = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  return (await getArtCatalog()).artworks.map(({ id }) => ({ id }));
}

export async function generateMetadata({ params }: ArtworkPageProps): Promise<Metadata> {
  const artwork = await getArtwork((await params).id);
  if (!artwork) notFound();
  return getPageMetadata({ path: `/art/${artwork.id}`, title: `${artwork.title_ko} · ${artwork.artist}`, description: `${artwork.artist}의 ${artwork.title_ko}. ${artwork.date}, ${artwork.medium_ko || artwork.medium}. ${artwork.museum} 소장. 작품 정보와 원출처를 살펴봅니다.`, image: artwork.preview_url });
}

export default async function ArtworkPage({ params }: ArtworkPageProps) {
  const artwork = await getArtwork((await params).id);
  if (!artwork) notFound();

  const artist = await getArtworkArtist(artwork);
  const related = artist
    ? (await getArtworksByArtist(artist.id)).filter((item) => item.id !== artwork.id).slice(0, 4)
    : [];

  return (
    <main className="archb-archive archive-detail" data-analytics-resource={`artwork:${artwork.id}`} data-analytics-path={`/art/${artwork.id}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumb([{ name: '홈', path: '/' }, { name: '아트', path: '/art' }, { name: artwork.title_ko, path: `/art/${artwork.id}` }]),
        { '@context': 'https://schema.org', '@type': 'VisualArtwork', '@id': sitePageUrl(`/art/${artwork.id}#artwork`), url: sitePageUrl(`/art/${artwork.id}`), name: artwork.title_ko, alternateName: artwork.title, image: artwork.preview_url, artMedium: artwork.medium_ko || artwork.medium, ...(artist ? { creator: { '@type': 'Person', name: artist.name_ko || artist.name, url: sitePageUrl(`/artists/${artist.id}`) } } : {}), isBasedOn: artwork.source_url },
      ]) }} />
      <nav className="archive-breadcrumb" aria-label="현재 위치">
        <Suspense fallback={<Link href="/art" className="hover:text-foreground">아트</Link>}><ArtworkBackLink /></Suspense>
        <span aria-hidden="true">/</span>
        <span>{artwork.title_ko}</span>
      </nav><div className="mb-5 flex justify-end"><SaveButton type="artwork" id={artwork.id} title={artwork.title_ko} /></div>

      <div data-analytics-body><article className="archive-artwork-layout">
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
            <dt className="text-muted-foreground">재료·기법</dt><dd>{artwork.medium_ko || artwork.medium || "미확인"}</dd>
            <dt className="text-muted-foreground">크기</dt><dd className="whitespace-pre-line">{artwork.dimensions_ko || artwork.dimensions || "미확인"}</dd>
            <dt className="text-muted-foreground">소장처</dt><dd>{artwork.museum}</dd>
            <dt className="text-muted-foreground">소장품 번호</dt><dd>{artwork.accession}</dd>
            <dt className="text-muted-foreground">이용 표시</dt><dd>{artwork.license}</dd>
            <dt className="text-muted-foreground">수집일</dt><dd>{artwork.collected_at.slice(0, 10)}</dd>
          </dl>

          {artwork.taxonomy && <div className="mb-5 border-t border-border pt-4">
            <h2 className="text-sm font-medium">작품 분류</h2>
            <ArtworkTags taxonomy={artwork.taxonomy} />
            <details className="mt-3 text-xs leading-6 text-muted-foreground"><summary className="cursor-pointer">분류 확인 출처</summary><p className="mt-2">원출처의 제작 시기·재료·해설과 미술사 맥락을 바탕으로 ARCH.B가 정리한 탐색 분류입니다.</p><ul>{artwork.taxonomy.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{source.label} <span aria-hidden="true">↗</span><span className="sr-only"> · 새 창</span></a></li>)}</ul></details>
          </div>}

          {(artwork.medium_ko || artwork.dimensions_ko) && <details className="mb-5 border-t border-border pt-4 text-sm leading-6"><summary className="cursor-pointer font-medium">재료·크기 원문 보기</summary><dl className="mt-3 space-y-2 text-muted-foreground"><dt>재료·기법</dt><dd>{artwork.medium || '미확인'}</dd><dt>크기</dt><dd>{artwork.dimensions || '미확인'}</dd></dl></details>}

          <p className="border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
            한국어 제목·재료·크기는 원출처를 바탕으로 정리했으며, 기준 정보인 원문을 함께 보존합니다.
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

      {artwork.description && <section className="archive-section" aria-labelledby="artwork-introduction">
        <div className="archive-section-heading"><h2 id="artwork-introduction">작품 이야기</h2></div>
        <p className="max-w-3xl whitespace-pre-line text-base leading-8">{artwork.description}</p>
        <a href={artwork.source_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-xs leading-6 text-muted-foreground underline underline-offset-4">확인 출처 · 작품 정보 <span aria-hidden="true">↗</span><span className="sr-only"> · 새 창</span></a>
      </section>}

      </div>{related.length > 0 && (
        <section className="archive-section" aria-labelledby="related-artworks">
          <div className="archive-section-heading">
            <h2 id="related-artworks">이 작가의 다른 작품</h2>
            <Link href={`/artists/${artist?.id}`} className="text-sm font-semibold hover:underline">작가 아카이브</Link>
          </div>
          <ArchiveMasonry label="이 작가의 다른 작품">
            {related.map((item) => <ArtworkCard key={item.id} artwork={item} />)}
          </ArchiveMasonry>
        </section>
      )}
    </main>
  );
}
