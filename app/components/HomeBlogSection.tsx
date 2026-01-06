"use client";

import { useEffect, useState } from "react";
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

type Category = {
  id: string;
  name: string;
};

// --- Skeleton Component ---
function BlogSkeleton() {
  // 보여줄 스켈레톤 아이템 개수 (3~4개 정도가 적당)
  const items = Array.from({ length: 4 });

  return (
    <div className="flex flex-col gap-8">
      {items.map((_, i) => (
        <div key={i} className="flex gap-6 animate-pulse h-full">
          {/* 이미지 영역 (w-64 aspect-video) */}
          <div className="w-64 aspect-video bg-gray-200 rounded-md shrink-0"></div>

          {/* 콘텐츠 영역 */}
          <div className="flex-1 flex flex-col py-1">
            {/* 카테고리 */}
            <div className="h-3 bg-gray-200 rounded w-16 mb-3"></div>
            
            {/* 제목 */}
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
            
            {/* 요약 */}
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>

            {/* 메타 정보 (날짜, 아이콘) */}
            <div className="mt-auto flex justify-between items-end pt-4">
              <div className="h-3 bg-gray-200 rounded w-24"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomeBlogSection() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 병렬 요청으로 로딩 속도 최적화
      const [postsRes, catsRes] = await Promise.all([
        fetch("/api/posts?type=blog&limit=6&offset=0"),
        fetch("/api/posts/categories?type=blog")
      ]);

      if (postsRes.ok) {
        const postData = await postsRes.json();
        setPosts(postData.data || []);
      }

      if (catsRes.ok) {
        const catData = await catsRes.json();
        const categoryMap = (catData.categories || []).reduce(
          (acc: Record<string, string>, cat: Category) => {
            acc[cat.id] = cat.name;
            return acc;
          },
          {}
        );
        setCategories(categoryMap);
      }
    } catch (error) {
      console.error("❌ 데이터 로드 에러:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <section className="px-4 col-span-3">
      <div className="contents mx-auto">
        {/* 헤더 부분은 항상 표시하여 레이아웃 흔들림 방지 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="mb-2 text-2xl font-bold">BLOG ARCHIVE</h2>
            <p className="text-gray-600">기술적 회고와 인사이트 기록</p>
          </div>
          <Link
            href="/blog"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition"
          >
            모두 보기 →
          </Link>
        </div>

        {/* 로딩 상태에 따라 스켈레톤 또는 리스트 렌더링 */}
        {loading ? (
          <BlogSkeleton />
        ) : posts.length === 0 ? (
          <div className="text-center text-gray-500 py-16 bg-gray-50 rounded-lg">
            블로그 글이 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group flex h-full gap-6 items-start"
              >
                {/* 이미지 */}
                <div className="relative w-64 aspect-video rounded-md overflow-hidden shrink-0 bg-gray-100">
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
                <div className="flex-1 flex flex-col h-full min-h-[144px]"> {/* min-h로 높이 확보 */}
                  {/* 카테고리 */}
                  {post.category_id && categories[post.category_id] && (
                    <p className="text-xs text-blue-600 font-bold mb-1 line-clamp-1">
                      [{categories[post.category_id]}]
                    </p>
                  )}

                  {/* 제목 */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {post.title}
                  </h3>

                  {/* 요약 */}
                  {post.summary && (
                    <p className="text-gray-600 mb-4 line-clamp-2 text-sm leading-relaxed">
                      {post.summary}
                    </p>
                  )}

                  {/* 메타 정보 */}
                  <div className="mt-auto flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-dashed border-gray-100">
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}