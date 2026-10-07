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
    <aside className="mainPopularBlog">
      {/* 제목 */}
      <div className="editorialSectionHead editorialSectionHeadCompact">
        <div>
          <p className="archive-eyebrow text-[var(--archive-brand)]">Most Read</p>
          <h2>많이 읽은 기록</h2>
        </div>
      </div>

      {/* 블로그 목록 */}
      <div className="space-y-4 mainPopularBlogItems">
        {initialPosts.length === 0 ? (
          <p className="px-6 text-sm text-gray-400">읽을 수 있는 기록을 준비하고 있습니다.</p>
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
                <div className="flex gap-3 border-b border-[var(--archive-line)] py-4 transition hover:border-[var(--archive-brand)]">
                  {/* 번호 */}
                  <div className="flex-shrink-0 w-8 text-center">
                    <p className="archive-index text-lg font-black text-primary">
                      0{index + 1}
                    </p>
                  </div>

                  {/* 콘텐츠 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="line-clamp-2 text-[13px] font-bold leading-[1.45] text-gray-900 transition group-hover:text-[var(--archive-brand)] dark:text-gray-100">
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
          <p className='text-sm text-gray-900 hover:text-[var(--archive-brand)] dark:text-gray-100'>모든 기록 보기 &rarr;</p>
        </Link>
      </div>
    </aside>
  );
}
