import { createClient } from "@/lib/supabase/server";
import GalleryClient from "./GalleryClient";
import { Suspense } from "react";

// 1. ISR 설정: 3600초(1시간)마다 페이지 캐시 갱신
export const revalidate = 7200;

// 동적 메타데이터 생성
export async function generateMetadata() {
  return {
    title: 'Generative Archive',
    description: '텍스트로 그려낸 상상의 단면들을 기록합니다. 인공지능이 생성한 독창적인 비주얼과 실험적인 텍스처를 탐험하세요.',
  };
}

export default async function GalleryPage() {
  const supabase = await createClient();
  const limit = 36;

  // 2. 서버에서 초기 데이터 조회 (페이지 1, 검색어 없음)
  const { data: galleryData, count } = await supabase
    .from('gallery')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, limit - 1);

  // 3. 총 페이지 수 계산
  const totalPages = count ? Math.ceil(count / limit) : 1;
  const initialGallery = galleryData || [];

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      {/* 4. Client Component에 초기 데이터 전달 */}
      <GalleryClient 
        initialGallery={initialGallery} 
        initialTotalPages={totalPages} 
      />
    </Suspense>
  );
}