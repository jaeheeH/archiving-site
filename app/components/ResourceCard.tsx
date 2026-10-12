import Link from 'next/link';
import ArchiveImage from './ArchiveImage';
import { SaveButton } from './SavedProvider';
import { RESOURCE_LABELS, type Resource } from '@/lib/resource';

function safeHref(value: string) {
  if (/^\/(?!\/)/.test(value)) return value;
  try { const url = new URL(value); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href; } catch {}
  return '/references';
}
export default function ResourceCard({ item }: { item: Resource }) {
  const href = safeHref(item.url);
  const external = item.type === 'reference';
  return <article className="resource-card">
    <Link href={href} className="resource-card-media" aria-label={`${item.title}${external ? ' · 새 창' : ''}`} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{item.image ? <ArchiveImage src={item.image} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px" className={['artwork', 'artist', 'reference'].includes(item.type) ? 'object-contain' : 'object-cover'} loading="lazy" /> : <span className="resource-placeholder" aria-hidden="true"><i className={item.type === 'post' ? 'ri-article-line' : 'ri-links-line'} /></span>}</Link>
    <div className="archive-card-copy">
      <p className="archive-card-label">{RESOURCE_LABELS[item.type]}</p>
      <div className="archive-card-title-row">
        <h2><Link href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{item.title}{external && <span className="sr-only"> · 새 창</span>}</Link></h2>
        <SaveButton type={item.type} id={item.id} title={item.title} iconOnly />
      </div>
      <p className="resource-card-description">{item.description}</p>
      <p className="resource-card-source">{item.source}</p>
    </div>
  </article>;
}
