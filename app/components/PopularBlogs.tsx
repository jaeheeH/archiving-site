"use client";

import Link from 'next/link';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  view_count: number;
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
              ? new Date(post.published_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
              : '';

            return (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="block group"
              >
                <div className="flex gap-4 pb-4 border-b border-gray-200 hover:border-gray-400 transition">
                  {/* 번호 */}
                  <div className="flex-shrink-0 w-8 text-center">
                    <p className="text-lg font-bold text-primary">
                      0{index + 1}
                    </p>
                  </div>

                  {/* 콘텐츠 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-gray-900 group-hover:text-blue-600 transition line-clamp-2 text-sm font-medium">
                      {post.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">
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
          <p className='text-gray-900 hover:text-[#ff4800] text-sm'>View All Blog &rarr;</p>
        </Link>
      </div>
    </div>
  );
}