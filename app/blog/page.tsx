import '@/app/css/blog/list.scss';
import BlogClient from './BlogClient';
import { getBlogCategories, getDailyGalleryImages, getPostsPageData } from '@/lib/public-data';
import { Suspense } from 'react';


// ISR 설정: 2시간마다 재생성
export const revalidate = 7200;


// 동적 메타데이터 생성
export async function generateMetadata() {
  return {
    title: 'Insights & Logs',
    description: '개발 과정의 고민과 디자인적 발견을 기록합니다. 프로젝트 비하인드 스토리와 기술적인 인사이트를 공유합니다.',
  };
}

export default async function BlogListPage() {
  const [{ data: posts, pagination: initialPagination }, categories, galleryImages] =
    await Promise.all([
      getPostsPageData('blog', 12, 0, 'all'),
      getBlogCategories(),
      getDailyGalleryImages(36),
    ]);

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <BlogClient 
        initialPosts={posts} 
        categories={categories} 
        initialPagination={initialPagination}
        dailyImages={galleryImages}
      />
    </Suspense>
  );
}
