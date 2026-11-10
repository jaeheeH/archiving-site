import Link from 'next/link';
import ArchiveImage from './ArchiveImage';
import DiscoveryFlow from './DiscoveryFlow';
import { getReferencesListData } from '@/lib/public-data';

export default async function HomeReferenceSection() {
  let references: Awaited<ReturnType<typeof getReferencesListData>>['data'];
  try { references = (await getReferencesListData(1, 9)).data; }
  catch (error) { console.error('Home references', error); return null; }
  if (!references.length) return null;

  return <section className="news-section news-home-reference-section" aria-labelledby="home-references-title">
    <div className="news-section-heading">
      <h2 id="home-references-title">참고사이트</h2>
      <Link href="/references">모든 사이트 <i className="ri-arrow-right-up-line" aria-hidden="true" /></Link>
    </div>
    <DiscoveryFlow id="home-reference-flow" label="흐르는 참고사이트 목록" direction="horizontal">
      {references.map(reference => <a key={reference.id} href={reference.url} target="_blank" rel="noopener noreferrer" data-analytics-resource={`reference:${reference.id}`} data-analytics-path="/references">
          <div className="news-home-reference-image">
            {reference.image_url ? <ArchiveImage src={reference.image_url} alt="" width={640} height={400} sizes="360px" loading="lazy" /> : <i className="ri-global-line" aria-hidden="true" />}
          </div>
          <div className="news-home-reference-copy">
            <h3>{reference.title} <i className="ri-arrow-right-up-line" aria-hidden="true" /><span className="sr-only"> (새 창)</span></h3>
            {reference.description && <p className="news-home-reference-description">{reference.description}</p>}
          </div>
      </a>)}
    </DiscoveryFlow>
  </section>;
}
