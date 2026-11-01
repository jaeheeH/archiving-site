import Link from 'next/link';
import { randomInt } from 'node:crypto';
import ArchiveImage from './ArchiveImage';
import { getArtCatalog } from '@/lib/art-catalog';
import { preoptimizedVariants } from '@/lib/image-variants';

export default async function NewsArchiveDiscovery() {
  let catalog: Awaited<ReturnType<typeof getArtCatalog>>;
  try { catalog = await getArtCatalog(); }
  catch (error) { console.error('Home archive discovery', error); return null; }
  const allWorks = catalog.artworks.filter(work => work.preview_url);
  const preparedWorks = allWorks.filter(work => preoptimizedVariants(work.preview_url));
  const works = preparedWorks.length ? preparedWorks : allWorks;
  if (!works.length) return null;
  const work = works[randomInt(works.length)];
  const makers = catalog.artists.filter(artist => works.some(item => item.artist_ids.includes(artist.id)));
  const maker = makers.length ? makers[randomInt(makers.length)] : undefined;
  const cover = maker && works.find(item => item.artist_ids.includes(maker.id));
  const workArtist = catalog.artists.find(artist => work.artist_ids.includes(artist.id));

  return <section className="news-archive-discovery" aria-labelledby="archive-discovery-title">
    <h2 id="archive-discovery-title">아카이브에서 발견하기</h2>
    <article className="news-discovery-work">
      <Link href={`/art/${work.id}`} className="news-discovery-image" tabIndex={-1} aria-hidden="true">
        <ArchiveImage src={work.preview_url} alt="" width={work.image_width || 640} height={work.image_height || 640} sizes="(max-width: 640px) 100vw, (max-width: 950px) 50vw, 300px" loading="lazy" />
      </Link>
      <h3><Link href={`/art/${work.id}`}>{work.title_ko || work.title}</Link></h3>
      <p className="news-discovery-meta">{workArtist?.name_ko || workArtist?.name || work.artist || '작가 미상'} · {work.date}</p>
    </article>
    {maker && cover && <article className="news-discovery-artist">
      <div>
        <Link href={`/artists/${maker.id}`} className="news-discovery-portrait" tabIndex={-1} aria-hidden="true">
          <ArchiveImage src={cover.preview_url} alt="" width={160} height={160} sizes="72px" loading="lazy" />
        </Link>
        <div><h3><Link href={`/artists/${maker.id}`}>{maker.name_ko || maker.name}</Link></h3><p className="news-discovery-meta">{[maker.profile?.lifespan, maker.profile?.context].filter(Boolean).join(' · ')}</p></div>
      </div>
    </article>}
  </section>;
}
