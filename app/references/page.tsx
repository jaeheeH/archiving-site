// app/references/page.tsx

import { Suspense } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import ReferenceContent from './ReferenceContent';

// ⚡ ISR 설정: 24시간마다 재검증
export const revalidate = 0; // 24시간

// 동적 메타데이터 생성
export async function generateMetadata() {
  return {
    title: 'References',
    description: '디자인, 개발, 마케팅 등 다양한 분야의 영감을 주는 사이트들을 모았습니다.',
  };
}

interface Reference {
  id: number;
  title: string;
  description: string | null;
  url: string;
  image_url: string;
  logo_url: string;
  range: string[] | null;
  clicks: number;
  created_at: string;
}

// 데이터 fetch (Server에서만 실행)
async function fetchReferencesData() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    const [catRes, refRes] = await Promise.all([
      fetch(`${baseUrl}/api/references-categories`, { 
        cache: 'no-store'
      }),
      fetch(`${baseUrl}/api/references?limit=100`, {
        cache: 'no-store'
      }),
    ]);

    const categories = catRes.ok ? (await catRes.json()).data : [];
    const references = refRes.ok ? (await refRes.json()).data : [];

    return {
      categories: categories.map((cat: any) => cat.name),
      references,
    };
  } catch (error) {
    console.error('❌ 데이터 fetch 실패:', error);
    return {
      categories: [],
      references: [],
    };
  }
}

// 🆕 로그인한 사용자의 스크랩 목록 조회
async function fetchUserScraps() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    // 사용자의 스크랩 ID만 가져오기
    const { data: scraps } = await supabase
      .from('reference_scraps')
      .select('reference_id')
      .eq('user_id', user.id);

    return scraps?.map((s: any) => s.reference_id) || [];
  } catch (error) {
    console.error('❌ 스크랩 목록 fetch 실패:', error);
    return [];
  }
}

export default async function ReferencesPage() {
  // 병렬로 데이터 fetch
  const [{ categories, references }, scrapedIds] = await Promise.all([
    fetchReferencesData(),
    fetchUserScraps(),
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      {/* Client Component에 props로 데이터 전달 */}
      <ReferenceContent 
        initialReferences={references}
        initialCategories={categories}
        initialScrapedIds={scrapedIds}
      />
    </Suspense>
  );
}