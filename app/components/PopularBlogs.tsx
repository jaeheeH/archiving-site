"use client";

import Link from 'next/link';
import { formatKoreanDate } from '@/lib/date-format';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  published_at?: string;
  category_id?: string | null;
}

interface PopularBlogsProps {
  initialPosts: BlogPost[];
  categories: Record<string, string>;
}

export default function PopularBlogs({ initialPosts, categories }: PopularBlogsProps) {
  
  return (
    <div className="pt-6 mainPopularBlog">
      {/* 제목 */}
      <div className='mb-6'>
        <h2 className="text-xl font-bold">인기 콘텐츠</h2>
      </div>

      {/* 블로그 목록 */}
      <div className="space-y-4 mainPopularBlogItems">
        {initialPosts.length === 0 ? (
          <p className="text-gray-400 text-sm">인기 글이 없습니다.</p>
        ) : (
          initialPosts.map((post, index) => {
            const categoryName = post.category_id
              ? categories[post.category_id]
              : null;
            const publishDate = post.published_at
              ? formatKoreanDate(post.published_at, "monthDay", "")
              : '';

            return (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="block group"
              >
                <div className="flex gap-4 border-b border-[var(--archive-line)] pb-4 transition hover:border-[#ff4800]">
                  {/* 번호 */}
                  <div className="flex-shrink-0 w-8 text-center">
                    <p className="text-lg font-bold text-primary">
                      0{index + 1}
                    </p>
                  </div>

                  {/* 콘텐츠 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="line-clamp-2 text-sm font-medium text-gray-900 transition group-hover:text-[#ff4800] dark:text-gray-100">
                      {post.title}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-xs text-gray-400 dark:text-gray-500">
                      {categoryName && <span>{categoryName} · </span>}
                      {publishDate}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
      <div className='popularLinkBtn mt-4'>
        <Link
          href={`/blog`}
          className='block text-right'
        >
          <p className='text-sm text-gray-900 hover:text-[#ff4800] dark:text-gray-100'>View All Blog &rarr;</p>
        </Link>
      </div>
    </div>
  );
}
