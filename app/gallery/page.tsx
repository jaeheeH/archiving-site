import { createClient } from "@/lib/supabase/server";
import GalleryClient from "./GalleryClient";
import { Suspense } from "react";

// 1. ISR 설정: 3600초(1시간)마다 페이지 캐시 갱신
export const revalidate = 3600;

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