'use client';

import { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

// --- Types ---
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

// --- Skeleton Component ---
function BlogSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  const items = Array.from({ length: 6 });

  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        {items.map((_, i) => (
          <div key={i} className="flex flex-col md:flex-row gap-6 border-b border-gray-100 pb-6 last:border-0 animate-pulse">
            <div className="w-full md:w-72 h-48 bg-gray-200 rounded-lg shrink-0"></div>
            <div className="flex-1 space-y-3 py-2">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-32 mt-auto"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Grid Skeleton
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {items.map((_, i) => (
        <div key={i} className="flex flex-col h-full animate-pulse">
          <div className="w-full aspect-video bg-gray-200 rounded-lg mb-4"></div>
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main Content Component ---
function BlogContent() {
  // State
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // Default View
  
  // Filter & Pagination State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit: 12,
    offset: 0,
    hasMore: false,
  });

  const POSTS_PER_PAGE = 12;

  // Initial Load & Category Fetch
  useEffect(() => {
    fetchCategories();
    // LocalStorage에서 뷰 모드 불러오기
    const savedView = localStorage.getItem('blog_view_mode');
    if (savedView === 'grid' || savedView === 'list') {
      setViewMode(savedView);
    }
  }, []);

  // Save View Mode
  useEffect(() => {
    localStorage.setItem('blog_view_mode', viewMode);
  }, [viewMode]);

  // Fetch Posts on Change
  useEffect(() => {
    fetchPosts(currentPage);
  }, [currentPage, selectedCategory]);

  const fetchPosts = async (page: number) => {
    try {
      setFetching(true);
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
      setFetching(false);
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
    if (!categoryId) return 'Uncategorized';
    const category = categories.find((cat) => cat.id === categoryId);
    return category?.name || 'Uncategorized';
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

  return (
    <div className="min-h-screen py-12">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-10 px-4 md:px-0">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4 font-sans uppercase">
          Insights & Logs<br />
          <span className="text-gray-400 font-light">Dev, Design, and Story</span>
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl leading-relaxed">
          개발 과정의 고민과 디자인적 발견을 기록합니다.<br />
          프로젝트 비하인드 스토리와 기술적인 인사이트를 공유합니다.
        </p>
      </div>

      <div className="max-w-7xl mx-auto pb-16 px-4 md:px-0">
        {/* Controls Toolbar */}
        <div className="sticky top-4 z-20 bg-white/80 backdrop-blur-md p-4 rounded-xl border border-gray-100 shadow-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleCategoryChange('all')}
              className={`px-3 py-1.5 rounded-md text-sm transition-all border ${
                selectedCategory === 'all'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id)}
                className={`px-3 py-1.5 rounded-md text-sm transition-all border ${
                  selectedCategory === category.id
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Right Side: View Toggle & Count */}
          <div className="flex items-center gap-4 ml-auto md:ml-0 w-full md:w-auto justify-end">
            <span className="text-xs text-gray-400 font-mono hidden md:inline-block">
              {pagination.total} Posts
            </span>
            
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-sm transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                aria-label="Grid view"
              >
                <i className="ri-layout-grid-line text-lg"></i>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md text-sm transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                aria-label="List view"
              >
                <i className="ri-list-check text-lg"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {loading || (fetching && posts.length === 0) ? (
          <BlogSkeleton viewMode={viewMode} />
        ) : filteredPosts.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-20 text-center border border-dashed border-gray-200">
            <p className="text-gray-500">작성된 글이 없습니다.</p>
          </div>
        ) : (
          <div className={
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" 
              : "space-y-6"
          }>
            {filteredPosts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className={`group block bg-white rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100 ${
                  viewMode === 'list' ? 'flex flex-col md:flex-row gap-6 p-4 border-gray-50 hover:bg-gray-50/50' : 'flex flex-col h-full'
                }`}
              >
                {/* Thumbnail */}
                <div className={`relative bg-gray-100 overflow-hidden shrink-0 ${
                  viewMode === 'list' 
                    ? 'w-full md:w-72 aspect-video md:aspect-[4/3] rounded-lg' 
                    : 'w-full aspect-video'
                }`}>
                  {post.title_image_url ? (
                    <>
                      <Image
                        src={post.title_image_url}
                        alt={post.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        sizes={viewMode === 'list' ? "300px" : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
                        quality={75}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <i className="ri-image-2-line text-3xl text-gray-300"></i>
                    </div>
                  )}
                </div>

                {/* Content Info */}
                <div className={`flex flex-col ${viewMode === 'list' ? 'flex-1 py-2' : 'flex-1 p-5'}`}>
                  
                  {/* Category */}
                  <div className="mb-2">
                    <span className="inline-block text-xs font-bold tracking-wider uppercase text-blue-600">
                      {getCategoryName(post.category_id)}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className={`font-bold text-gray-900 mb-2 leading-snug group-hover:text-blue-600 transition-colors ${
                    viewMode === 'list' ? 'text-2xl' : 'text-xl line-clamp-2'
                  }`}>
                    {post.title}
                  </h2>

                  {/* Summary */}
                  <p className={`text-gray-500 text-sm mb-4 leading-relaxed ${
                    viewMode === 'list' ? 'line-clamp-3' : 'line-clamp-2'
                  }`}>
                    {post.summary || post.subtitle || '내용이 없습니다.'}
                  </p>

                  {/* Footer Meta */}
                  <div className={`mt-auto flex items-center justify-between text-xs text-gray-400 font-mono ${
                    viewMode === 'list' ? '' : 'pt-4 border-t border-gray-100'
                  }`}>
                    <span>{new Date(post.published_at || post.created_at).toLocaleDateString('ko-KR')}</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <i className="ri-eye-line"></i> {post.view_count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-bookmark-line"></i> {post.scrap_count || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-16">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition text-sm"
            >
              Previous
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition text-sm ${
                    page === currentPage
                      ? 'bg-black text-white font-medium'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BlogListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <BlogContent />
    </Suspense>
  );
}