import { SaveButton } from '@/app/components/SavedProvider';
import { getPageMetadata } from '@/lib/site-settings';
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArtworkCard from "@/app/art/ArtworkCard";
import ArchiveMasonry from '@/app/components/ArchiveMasonry';
import { getArtCatalog, getArtist, getArtworksByArtist } from "@/lib/art-catalog";
import { jsonLd, breadcrumb, sitePageUrl } from '@/lib/seo';
import { readNewsSummaries } from '@/lib/news';
import { artTaxonomyTags } from '@/lib/art-taxonomy';

type ArtistPageProps = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  return (await getArtCatalog()).artists.map(({ id }) => ({ id }));
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const artist = await getArtist((await params).id);
  if (!artist) notFound();
  const works = await getArtworksByArtist(artist.id);
  return getPageMetadata({ path: `/artists/${artist.id}`, title: `${artist.name_ko || artist.name} · 작가`, description: artist.profile?.description || `${artist.name}의 수집 작품 ${works.length}점을 소장 기관과 시기별로 살펴봅니다. 작품 상세 정보와 원출처를 함께 확인합니다.`, image: works[0]?.preview_url });
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const artist = await getArtist((await params).id);
  if (!artist) notFound();

  const artistArtworks = await getArtworksByArtist(artist.id);
  const museums = [...new Set(artistArtworks.map((artwork) => artwork.museum))];
  const profile = artist.profile;
  const relatedIds = profile?.related_post_ids || [];
  const articles = relatedIds.length ? (await readNewsSummaries()).articles : [];
  const related = relatedIds.flatMap(id => { const article = articles.find(item => item.id === id); return article ? [article] : []; });

  return (
    <main className="archb-archive archive-detail">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumb([{ name: '홈', path: '/' }, { name: '작가', path: '/artists' }, { name: artist.name_ko || artist.name, path: `/artists/${artist.id}` }]),
        { '@context': 'https://schema.org', '@type': 'ProfilePage', '@id': sitePageUrl(`/artists/${artist.id}`), citation: profile?.sources?.map(source => source.url), mainEntity: { '@type': 'Person', name: artist.name_ko || artist.name, alternateName: artist.name, description: profile?.description, url: sitePageUrl(`/artists/${artist.id}`) } },
      ]) }} />
      <nav className="archive-breadcrumb" aria-label="현재 위치">
        <Link href="/artists" className="hover:text-foreground">작가</Link><span aria-hidden="true">/</span><span>{artist.name_ko || artist.name}</span>
      </nav><div className="mb-5 flex justify-end"><SaveButton type="artist" id={artist.id} title={artist.name_ko || artist.name} /></div>
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

      {profile?.description && <section className="archive-artist-profile" aria-labelledby="artist-introduction">
        <div><h2 id="artist-introduction">작가 소개</h2>{(profile.lifespan || profile.context) && <p className="archive-card-meta mt-3">{[profile.lifespan, profile.context].filter(Boolean).join(' · ')}</p>}</div>
        <div><p className="whitespace-pre-line text-base leading-8">{profile.description}</p>{!!profile.sources?.length && <div className="mt-5 text-xs leading-6 text-muted-foreground"><p>확인 출처</p><ul className="mt-1 space-y-1">{profile.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{source.label} <span aria-hidden="true">↗</span><span className="sr-only"> · 새 창</span></a></li>)}</ul></div>}</div>
      </section>}

      <div className="archive-note">
        <strong className="text-foreground">현재 수집 범위</strong> · {museums.join(" · ")}. 이 페이지의 수량은 해당 작가의 전작이 아니라 ARCH.B가 확인한 표본입니다.
      </div>

      <ul className="archive-tags archive-artist-tags" aria-label="수집 작품의 시대·사조·종류">{artTaxonomyTags(artistArtworks.flatMap(work => work.taxonomy ? [work.taxonomy] : [])).filter(tag => tag.group !== 'subject').map(tag => <li key={`${tag.group}-${tag.id}`}><Link href={`/art?${new URLSearchParams({ artist: artist.id, [tag.group]: tag.id })}`}>{tag.label} 작품 보기</Link></li>)}</ul>

      <ArchiveMasonry label={`${artist.name_ko || artist.name} 작품 목록`}>
        {artistArtworks.map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} />)}
      </ArchiveMasonry>
      {related.length > 0 && <section className="archive-section" aria-labelledby="artist-related-articles"><div className="archive-section-heading"><h2 id="artist-related-articles">함께 읽는 글</h2></div><div className="archive-grid">{related.map(article => <article className="archive-card border-t border-border pt-4" key={article.id}><p className="archive-card-meta">{article.source}</p><h3><Link href={`/news/read/${article.slug}`}>{article.title}</Link></h3><p className="archive-card-description line-clamp-3">{article.summary}</p><Link href={`/news/read/${article.slug}`} className="mt-4 inline-block text-sm underline underline-offset-4">글 읽기 →</Link></article>)}</div></section>}
    </main>
  );
}
