// app/references/page.tsx

import { Suspense } from 'react';
import ReferenceContent from './ReferenceContent';
import { getReferencesPageData } from '@/lib/public-data';
import { getPageMetadata } from '@/lib/site-settings';
import { SITE_COPY } from '@/lib/site-copy';

// ⚡ ISR 설정: 24시간마다 재검증
export const revalidate = 86400;

// 동적 메타데이터 생성
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const params = await searchParams;
  return getPageMetadata({ path: '/references', title: '참고사이트', description: SITE_COPY.references.description, image: '/api/og?type=references-list', noindex: !!(params.q?.trim() || (params.category && params.category !== 'all')) });
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
