import GalleryClient from "./GalleryClient";
import { Suspense } from "react";
import { getGalleryPageData } from "@/lib/public-data";
import { getSiteUrl } from "@/lib/site-url";
import { SITE_COPY } from "@/lib/site-copy";

// 1. ISR 설정: 3600초(1시간)마다 페이지 캐시 갱신
export const revalidate = 7200;

// 동적 메타데이터 생성
export async function generateMetadata() {
  const siteUrl = getSiteUrl();
  const ogImage = `${siteUrl}/api/og?type=gallery-list`;

  return {
    title: SITE_COPY.gallery.title,
    description: SITE_COPY.gallery.description,
    openGraph: {
      title: SITE_COPY.gallery.title,
      description: SITE_COPY.gallery.description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'Generative Archive' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_COPY.gallery.title,
      description: SITE_COPY.gallery.description,
      images: [ogImage],
    },
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
