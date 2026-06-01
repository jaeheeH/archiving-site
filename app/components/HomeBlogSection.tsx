"use client";

import Link from "next/link";
import Image from "next/image";

type BlogPost = {
  id: string;
  title: string;
  subtitle?: string;
  summary?: string;
  slug: string;
  published_at?: string;
  created_at: string;
  title_image_url?: string;
  category_id?: string;
  view_count: number;
  scrap_count: number;
};

interface HomeBlogSectionProps {
  initialPosts: BlogPost[];
  categories: Record<string, string>;
}

export default function HomeBlogSection({ initialPosts, categories }: HomeBlogSectionProps) {
  // 이미 데이터가 있는 상태이므로 로딩 상태 관리 불필요
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="lg:col-span-3">
      {initialPosts.length === 0 ? (
        <div className="rounded-lg bg-gray-50 py-16 text-center text-gray-500 dark:bg-[#151515] dark:text-gray-400">
          블로그 글이 없습니다.
        </div>
      ) : (
        <div className="mainHomeBlog">
          <div className="items">
            {initialPosts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group flex h-full gap-6 items-start"
              >
                <article className="hover:bg-gray-50 dark:hover:bg-[#151515]">
                  {/* 이미지 */}
                  <div className="thumbnail relative shrink-0 overflow-hidden bg-gray-100 dark:bg-[#1d1d1d]">
                    {post.title_image_url ? (
                      <Image
                        src={post.title_image_url}
                        alt={post.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        quality={75}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-400 dark:text-gray-600">
                        <i className="ri-image-2-line text-3xl"></i>
                      </div>
                    )}
                  </div>

                  {/* 콘텐츠 */}
                  <div className="info flex-1 flex flex-col min-h-[135px]">
                    {/* 카테고리 */}
                    {post.category_id && categories[post.category_id] && (
                      <p className="text-xs text-primary font-bold mb-2 line-clamp-1">
                        {categories[post.category_id]}
                      </p>
                    )}

                    {/* 제목 */}
                    <h3 className="mb-2 line-clamp-2 font-semibold text-gray-900 transition-colors group-hover:text-[#ff4800] dark:text-gray-100">
                      {post.title}
                    </h3>

                    {/* 요약 */}
                    {post.summary && (
                      <p className="desc mb-4 line-clamp-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                        {post.summary}
                      </p>
                    )}

                    {/* 메타 정보 */}
                    <div className="mt-auto flex items-center justify-between border-gray-100 pt-2 text-xs text-gray-400 dark:text-gray-500">
                      <span>
                        {formatDate(post.published_at || post.created_at)}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <i className="ri-eye-line"></i>
                          {post.view_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ri-bookmark-line"></i>
                          {post.scrap_count || 0}
                        </span>
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
