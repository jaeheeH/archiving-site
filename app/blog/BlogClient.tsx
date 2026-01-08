'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

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

interface BlogClientProps {
  initialPosts: Post[];
  categories: Category[];
  initialPagination: PaginationInfo;
}

export default function BlogClient({ initialPosts, categories, initialPagination }: BlogClientProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [fetching, setFetching] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>(initialPagination);

  const POSTS_PER_PAGE = 12;

  useEffect(() => {
    const savedView = localStorage.getItem('blog_view_mode');
    if (savedView === 'grid' || savedView === 'list') {
      setViewMode(savedView);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('blog_view_mode', viewMode);
  }, [viewMode]);

  // 카테고리나 페이지 변경 시 API를 통해 데이터를 새로 가져옴
  const fetchPosts = async (page: number, categoryId: string) => {
    try {
      setFetching(true);
      const offset = (page - 1) * POSTS_PER_PAGE;
      const categoryParam = categoryId !== 'all' ? `&category_id=${categoryId}` : '';
      const res = await fetch(
        `/api/posts?type=blog&limit=${POSTS_PER_PAGE}&offset=${offset}${categoryParam}`
      );
      const data = await res.json();
      setPosts(data.data || []);
      setPagination(data.pagination || {});
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setFetching(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchPosts(page, selectedCategory);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
    fetchPosts(1, categoryId);
  };

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find((cat) => cat.id === categoryId);
    return category?.name || 'Uncategorized';
  };

  const totalPages = Math.ceil(pagination.total / POSTS_PER_PAGE);

  return (
    <div className="min-h-screen py-12">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-10 px-4 md:px-0">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4 font-sans uppercase">
          Insights & Logs
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl leading-relaxed">
          개발 과정의 고민과 디자인적 발견을 기록합니다.<br />
          프로젝트 비하인드 스토리와 기술적인 인사이트를 공유합니다.
        </p>
      </div>

      <div className="max-w-7xl mx-auto pb-16 px-4 md:px-0">
        {/* Toolbar */}
        <div className="sticky top-4 z-20 bg-white/80 backdrop-blur-md p-4 rounded-xl border border-gray-100 shadow-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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

          <div className="flex items-center gap-4 ml-auto md:ml-0 w-full md:w-auto justify-end">
            <span className="text-xs text-gray-400 font-mono hidden md:inline-block">
              {pagination.total} Posts
            </span>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-sm transition-all ${
                  viewMode === 'grid' ? 'bg-white text-black shadow-sm' : 'text-gray-400'
                }`}
              >
                <i className="ri-layout-grid-line text-lg"></i>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md text-sm transition-all ${
                  viewMode === 'list' ? 'bg-white text-black shadow-sm' : 'text-gray-400'
                }`}
              >
                <i className="ri-list-check text-lg"></i>
              </button>
            </div>
          </div>
        </div>

        {/* List Content */}
        {fetching && posts.length === 0 ? (
          <div className="animate-pulse">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-20 text-center">작성된 글이 없습니다.</div>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-6"}>
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className={`group block bg-white rounded-xl overflow-hidden hover:shadow-xl transition-all border ${
                  viewMode === 'list' ? 'flex flex-col md:flex-row gap-6 p-4' : 'flex flex-col h-full'
                }`}
              >
                <div className={`relative bg-gray-100 overflow-hidden shrink-0 ${
                  viewMode === 'list' ? 'w-full md:w-72 aspect-video md:aspect-[4/3] rounded-lg' : 'w-full aspect-video'
                }`}>
                  {post.title_image_url ? (
                    <Image src={post.title_image_url} alt={post.title} fill className="object-cover" sizes="300px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><i className="ri-image-2-line text-3xl text-gray-300"></i></div>
                  )}
                </div>

                <div className={`flex flex-col ${viewMode === 'list' ? 'flex-1 py-2' : 'flex-1 p-5'}`}>
                  <span className="mb-2 text-xs font-bold text-blue-600 uppercase">{getCategoryName(post.category_id)}</span>
                  <h2 className={`font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors ${viewMode === 'list' ? 'text-2xl' : 'text-xl line-clamp-2'}`}>
                    {post.title}
                  </h2>
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">{post.summary || post.subtitle || '내용이 없습니다.'}</p>
                  <div className="mt-auto flex items-center justify-between text-xs text-gray-400 font-mono">
                    <span>{new Date(post.published_at || post.created_at).toLocaleDateString('ko-KR')}</span>
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
              className="px-4 py-2 rounded-lg border disabled:opacity-30"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`w-8 h-8 rounded-lg ${page === currentPage ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-lg border disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}