'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface Post {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  slug: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  title_image_url: string | null;
  category_id: string | null;
  view_count?: number;
  scrap_count?: number;
}

interface Category {
  id: string;
  name: string;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export default function BlogListPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit: 12,
    offset: 0,
    hasMore: false,
  });

  const POSTS_PER_PAGE = 12;

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchPosts(currentPage);
  }, [currentPage, selectedCategory]);

  const fetchPosts = async (page: number) => {
    try {
      setLoading(true);
      const offset = (page - 1) * POSTS_PER_PAGE;
      const res = await fetch(
        `/api/posts?type=blog&limit=${POSTS_PER_PAGE}&offset=${offset}`
      );
      const data = await res.json();
      setPosts(data.data || []);
      setPagination(data.pagination || {});
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/posts/categories?type=blog');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return '미분류';
    const category = categories.find((cat) => cat.id === categoryId);
    return category?.name || '미분류';
  };

  const filteredPosts = posts.filter((post) => {
    if (selectedCategory === 'all') return true;
    return post.category_id === selectedCategory;
  });

  const totalPages = Math.ceil(pagination.total / POSTS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
  };

  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen  py-12">
      {/* Header */}

      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-4xl md:text-4xl font-bold tracking-tight text-gray-900 mb-4">
          EXHIBITION EVENT <br></br>
          SCHEDULE
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl leading-relaxed ">
            서울을 중심으로 열리는 주요 전시, <br></br>
            디자인 컨퍼런스, 팝업 스토어 일정을 큐레이션합니다.
          </p>
      </div>
      {/* 총 개수 표시 */}
      <div className="max-w-7xl mx-auto mb-4">
        <p className="text-sm text-gray-600">총 {pagination.total}개의 글</p>
      </div>

      <div className="max-w-7xl mx-auto  pb-16">
        {/* Category Filter */}
        <div className="mb-12 flex gap-2 flex-wrap">
          <button
            onClick={() => handleCategoryChange('all')}
            className={`px-4 py-2 rounded-lg transition text-sm font-medium ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryChange(category.id)}
              className={`px-4 py-2 rounded-lg transition text-sm font-medium ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Posts Grid */}
        {filteredPosts.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-500 text-lg">작성된 글이 없습니다</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col h-full hover:opacity-80 transition"
                >
                  {/* Thumbnail - 16:9 비율 */}
                  <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
                    {post.title_image_url ? (
                      <Image
                        src={post.title_image_url}
                        alt={post.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        quality={75}
                        placeholder="blur"
                        blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23f3f4f6' width='16' height='9'/%3E%3C/svg%3E"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                        <i className="ri-image-2-line text-4xl text-gray-400"></i>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col">
                    {/* Category Badge */}
                    <div className="mb-3">
                      <span className="inline-block px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                        {getCategoryName(post.category_id)}
                      </span>
                    </div>

                    {/* Subtitle */}
                    {post.subtitle && (
                      <p className="text-gray-600 text-sm mb-1 line-clamp-1">{post.subtitle}</p>
                    )}

                    {/* Title */}
                    <h2 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition">
                      {post.title}
                    </h2>


                    {/* Summary */}
                    {post.summary && (
                      <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                        {post.summary}
                      </p>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-100">
                      <span>{new Date(post.published_at || post.created_at).toLocaleDateString('ko-KR')}</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <i className="ri-eye-line"></i>
                          {post.view_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ri-bookmark-line"></i>
                          {post.scrap_count || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  이전
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-4 py-2 rounded-lg transition ${
                      page === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}