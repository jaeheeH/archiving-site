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
        <div className="text-center text-gray-500 py-16 bg-gray-50 rounded-lg">
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
                <article className="hover:bg-gray-50 ">
                  {/* 이미지 */}
                  <div className="thumbnail relative overflow-hidden shrink-0 bg-gray-100">
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
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
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
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 transition-colors">
                      {post.title}
                    </h3>

                    {/* 요약 */}
                    {post.summary && (
                      <p className="text-gray-600 mb-4 line-clamp-2 text-sm leading-relaxed desc">
                        {post.summary}
                      </p>
                    )}

                    {/* 메타 정보 */}
                    <div className="mt-auto flex items-center justify-between text-xs text-gray-400 pt-2 border-gray-100">
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