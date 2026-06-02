// app/references/page.tsx

import { Suspense } from 'react';
import ReferenceContent from './ReferenceContent';
import { getReferencesPageData } from '@/lib/public-data';
import { getSiteUrl } from '@/lib/site-url';

// ⚡ ISR 설정: 24시간마다 재검증
export const revalidate = 86400;

// 동적 메타데이터 생성
export async function generateMetadata() {
  const siteUrl = getSiteUrl();
  const ogImage = `${siteUrl}/api/og?type=references-list`;

  return {
    title: 'References',
    description: '디자인, 개발, 마케팅 등 다양한 분야의 영감을 주는 사이트들을 모았습니다.',
    openGraph: {
      title: 'References',
      description: '디자인, 개발, 마케팅 등 다양한 분야의 영감을 주는 사이트들을 모았습니다.',
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'ARCH-B References' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'References',
      description: '디자인, 개발, 마케팅 등 다양한 분야의 영감을 주는 사이트들을 모았습니다.',
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
