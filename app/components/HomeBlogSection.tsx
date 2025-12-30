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

export default function HomeBlogSection() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchBlogPosts();
    fetchCategories();
  }, []);

  const fetchBlogPosts = async () => {
    try {
      setLoading(true);
      // 발행된 최신 블로그 글 6개 조회
      const res = await fetch("/api/posts?type=blog&limit=6&offset=0");
      if (!res.ok) throw new Error("Failed to fetch posts");

      const data = await res.json();
      setPosts(data.data || []);
    } catch (error) {
      console.error("❌ 블로그 글 조회 에러:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/posts/categories?type=blog");
      if (!res.ok) throw new Error("Failed to fetch categories");

      const data = await res.json();
      const categoryMap = (data.categories || []).reduce(
        (acc: Record<string, string>, cat: Category) => {
          acc[cat.id] = cat.name;
          return acc;
        },
        {}
      );
      setCategories(categoryMap);
    } catch (error) {
      console.error("❌ 카테고리 조회 에러:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <section className="py-16 px-4 ">
        <div className="contents mx-auto">
          <h2 className="text-2xl font-bold mb-12">블로그</h2>
          <div className="text-center text-gray-500 py-16">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400"></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (posts.length === 0) {
    return (
      <section className="py-16 px-4 ">
        <div className="contents mx-auto">
          <h2 className="text-4xl font-bold mb-12">블로그</h2>
          <div className="text-center text-gray-500 py-16">
            블로그 글이 없습니다.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 px-4 col-span-3">
      <div className="contents mx-auto">
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

        {/* 블로그 그리드 */}
        <div className="flex flex-col gap-8">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group flex h-full gap-6 "
            >
              {/* 이미지 */}
              {post.title_image_url ? (
                <div className="relative w-40 aspect-video  rounded-md overflow-hidden  align-middle">
                  <Image
                    src={post.title_image_url}
                    alt={post.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover "
                    quality={75}
                    placeholder="blur"
                    blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23f3f4f6' width='16' height='9'/%3E%3C/svg%3E"
                  />
                </div>
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-4 flex items-center justify-center">
                  <i className="ri-image-2-line text-3xl text-gray-400"></i>
                </div>
              )}

              {/* 콘텐츠 */}
              <div className="flex-1 flex flex-col">
                {/* 카테고리 */}
                {post.category_id && categories[post.category_id] && (
                  <p className="text-xs text-blue-600 font-bold mb-1 line-clamp-1">
                    [{categories[post.category_id]}]
                  </p>
                )}

                
                {/* 제목 */}
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {post.title}
                </h3>

                {/* 요약 */}
                {post.summary && (
                  <p className="text-gray-600 mb-4 line-clamp-3 ">
                    {post.summary}
                  </p>
                )}

                {/* 메타 정보 */}
                <div className="flex items-center justify-between text-sm text-gray-500 pt-4  border-gray-100">
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
      </div>
    </section>
  );
}