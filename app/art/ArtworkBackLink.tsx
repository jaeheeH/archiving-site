'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { artReturnHref } from '@/lib/art-list';

export default function ArtworkBackLink() {
  const href = artReturnHref(useSearchParams().get('from'));
  return <Link href={href} className="hover:text-foreground">아트</Link>;
}
