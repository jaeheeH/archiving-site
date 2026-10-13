import Link from 'next/link';
import { artTaxonomyTags, type ArtTaxonomy } from '@/lib/art-taxonomy';

export default function ArtworkTags({ taxonomy, groups, artist }: { taxonomy?: ArtTaxonomy | ArtTaxonomy[]; groups?: string[]; artist?: string }) {
  const tags = artTaxonomyTags(taxonomy).filter(tag => !groups || groups.includes(tag.group));
  if (!tags.length) return null;
  return <ul className="archive-tags" aria-label="작품 분류">{tags.map(tag => {
    const query = new URLSearchParams({ [tag.group]: tag.id, ...(artist ? { artist } : {}) });
    return <li key={`${tag.group}-${tag.id}`}><Link href={`/art?${query}`} aria-label={`${tag.label} 작품 보기`}>{tag.label}</Link></li>;
  })}</ul>;
}
