import Link from 'next/link';
import { randomInt } from 'node:crypto';
import ArchiveImage from './ArchiveImage';
import DiscoveryFlow from './DiscoveryFlow';
import NewsArchiveDiscovery from './NewsArchiveDiscovery';
import { getArtCatalog } from '@/lib/art-catalog';

export default async function HomeArtSection() {
  let catalog: Awaited<ReturnType<typeof getArtCatalog>>;
  try { catalog = await getArtCatalog(); }
  catch (error) { console.error('Home artwork', error); return null; }
  const works = catalog.artworks.filter(work => work.preview_url);
  if (!works.length) return null;
  for (let index = 0; index < Math.min(9, works.length); index++) {
    const other = randomInt(index, works.length);
    [works[index], works[other]] = [works[other], works[index]];
  }
  const selected = works.slice(0, 9);

  return <section className="news-section news-home-art" aria-labelledby="home-art-title">
    <div className="news-section-heading">
      <div><h2 id="home-art-title">Artwork</h2><p className="news-art-intro">회화와 판화, 드로잉을 넘나들며 서로 다른 표현을 만나보세요. 시대와 사조, 재료와 주제를 따라 작품을 보고 작가와 소장 기관의 이야기를 이어 봅니다.</p></div>
      <Link href="/art">모든 작품 <i className="ri-arrow-right-up-line" aria-hidden="true" /></Link>
    </div>
    <DiscoveryFlow id="home-art-flow" label="흐르는 작품 목록" direction="vertical">
      {selected.map(work => {
        const artist = catalog.artists.find(person => work.artist_ids.includes(person.id));
        const href = '/art/' + work.id;
        return <Link key={work.id} prefetch={false} href={href} data-analytics-resource={'artwork:' + work.id} data-analytics-path={href}>
            <div className="news-home-artwork-image">
              <ArchiveImage src={work.preview_url} alt="" width={work.image_width || 640} height={work.image_height || 640} sizes="(max-width: 640px) 240px, (max-width: 950px) 44vw, 340px" loading="eager" fetchPriority="low" />
            </div>
            <div className="news-home-artwork-copy">
              <h3>{work.title_ko || work.title}</h3>
              <p className="news-discovery-meta">{artist?.name_ko || artist?.name || work.artist || '작가 미상'}{work.date && ' · ' + work.date}</p>
              <p className="news-discovery-meta">{work.museum}</p>
            </div>
        </Link>;
      })}
    </DiscoveryFlow>
    <NewsArchiveDiscovery />
  </section>;
}
