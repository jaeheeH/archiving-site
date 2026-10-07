import GalleryClient from "./GalleryClient";
import { Suspense } from "react";
import { getGalleryPageData } from "@/lib/public-data";
import { notFound } from 'next/navigation';
import { pageMetadata } from '@/lib/seo';
import { SITE_COPY } from "@/lib/site-copy";

// 1. ISR 설정: 3600초(1시간)마다 페이지 캐시 갱신
export const revalidate = 7200;

// 동적 메타데이터 생성
type GalleryPageProps = { searchParams: Promise<{ page?: string; search?: string; tags?: string }> };
const pageNumber = (value?: string) => Math.min(10000, Math.max(1, Number.parseInt(value || '1', 10) || 1));
export async function generateMetadata({ searchParams }: GalleryPageProps) {
  const params = await searchParams;
  const page = pageNumber(params.page);
  return pageMetadata({ path: `/gallery${page > 1 ? `?page=${page}` : ''}`, title: `갤러리${page > 1 ? ` · ${page}페이지` : ''}`, description: SITE_COPY.gallery.description, image: '/api/og?type=gallery-list', noindex: !!(params.search?.trim() || params.tags) });
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const params = await searchParams;
  const page = pageNumber(params.page);
  const limit = 36;
  const { data: initialGallery, pagination } = await getGalleryPageData(page, limit, params.search?.slice(0, 100) || '', params.tags?.slice(0, 500) || '').catch(error => {
    if (error?.code === 'PGRST103') notFound();
    throw error;
  });
  if (page > pagination.totalPages) notFound();

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      {/* 4. Client Component에 초기 데이터 전달 */}
      <GalleryClient 
        initialGallery={initialGallery} 
        initialTotalPages={pagination.totalPages} 
        initialPage={page}
      />
    </Suspense>
  );
}
