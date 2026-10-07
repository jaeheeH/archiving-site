// app/references/page.tsx

import { Suspense } from 'react';
import ReferenceContent from './ReferenceContent';
import { getReferencesPageData } from '@/lib/public-data';
import { getSiteUrl } from '@/lib/site-url';
import { SITE_COPY } from '@/lib/site-copy';

// ⚡ ISR 설정: 24시간마다 재검증
export const revalidate = 86400;

// 동적 메타데이터 생성
export async function generateMetadata() {
  const siteUrl = getSiteUrl();
  const ogImage = `${siteUrl}/api/og?type=references-list`;

  return {
    title: '참고사이트',
    description: SITE_COPY.references.description,
    openGraph: {
      title: '참고사이트',
      description: SITE_COPY.references.description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'ARCH.B 참고사이트' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: '참고사이트',
      description: SITE_COPY.references.description,
      images: [ogImage],
    },
  };
}

export default async function ReferencesPage() {
  const { categories, references } = await getReferencesPageData();

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      {/* Client Component에 props로 데이터 전달 */}
      <ReferenceContent 
        initialReferences={references}
        initialCategories={categories}
      />
    </Suspense>
  );
}
