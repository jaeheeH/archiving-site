import GalleryClient from "./GalleryClient";
import { Suspense } from "react";
import { getGalleryPageData } from "@/lib/public-data";

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
  const limit = 36;
  const { data: initialGallery, pagination } = await getGalleryPageData(1, limit);

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      {/* 4. Client Component에 초기 데이터 전달 */}
      <GalleryClient 
        initialGallery={initialGallery} 
        initialTotalPages={pagination.totalPages} 
      />
    </Suspense>
  );
}
