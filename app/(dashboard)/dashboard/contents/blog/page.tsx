'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Post {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  slug: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  title_image_url: string | null;
  category_id: string | null;
  view_count?: number;
  scrap_count?: number;
  author_id: string;
}

interface Category {
  id: string;
  name: string;
}

interface User {
  id: string;
  role: string;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

type SortType = 'latest' | 'oldest' | 'popular';

export default function BlogPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortType, setSortType] = useState<SortType>('latest');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authors, setAuthors] = useState<Record<string, User>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
  });

  const POSTS_PER_PAGE = 20;

  useEffect(() => {
    fetchCurrentUser();
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchPosts(currentPage);
  }, [currentPage]);

  const fetchCurrentUser = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', user.id)
        .single();

      if (profile) {
        setCurrentUser(profile);
      }
    }
  };

  const fetchPosts = async (page: number) => {
    try {
      setLoading(true);
      const offset = (page - 1) * POSTS_PER_PAGE;
      const res = await fetch(
        `/api/admin/posts?type=blog&limit=${POSTS_PER_PAGE}&offset=${offset}`
      );
      const data = await res.json();

      if (!res.ok) {
        console.error('Failed to fetch posts:', data.error);
        setPosts([]);
        return;
      }

      const postsData = data.data || [];
      setPosts(postsData);
      setPagination(data.pagination || {});

      // 작성자 정보 가져오기
      const authorIds = [...new Set(postsData.map((p: Post) => p.author_id))];
      if (authorIds.length > 0) {
        const supabase = createClient();
        const { data: authorsData } = await supabase
          .from('users')
          .select('id, role')
          .in('id', authorIds);

        if (authorsData) {
          const authorsMap: Record<string, User> = {};
          authorsData.forEach((author) => {
            authorsMap[author.id] = author;
          });
          setAuthors(authorsMap);
        }
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/posts/categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('삭제되었습니다');
        fetchPosts(currentPage);
      } else {
        alert('삭제 실패');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('삭제 중 오류가 발생했습니다');
    }
  };

  const handleTogglePublish = async (post: Post) => {
    try {
      const res = await fetch(`/api/posts/${post.id}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_published: !post.is_published,
        }),
      });

      if (res.ok) {
        fetchPosts(currentPage);
      } else {
        alert('발행 상태 변경 실패');
      }
    } catch (error) {
      console.error('Toggle publish failed:', error);
      alert('발행 상태 변경 중 오류가 발생했습니다');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      alert('카테고리 이름을 입력해주세요');
      return;
    }

    try {
      const res = await fetch('/api/posts/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName }),
      });

      if (res.ok) {
        setNewCategoryName('');
        setShowAddCategory(false);
        fetchCategories();
      } else {
        alert('카테고리 추가 실패');
      }
    } catch (error) {
      console.error('Add category failed:', error);
      alert('카테고리 추가 중 오류가 발생했습니다');
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`"${categoryName}" 카테고리를 삭제하시겠습니까?\n이 카테고리를 사용하는 포스트가 있으면 삭제할 수 없습니다.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/posts/categories?id=${categoryId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        alert('카테고리가 삭제되었습니다');
        if (categoryFilter === categoryId) {
          setCategoryFilter('all');
        }
        fetchCategories();
      } else {
        alert(data.error || '카테고리 삭제 실패');
      }
    } catch (error) {
      console.error('Delete category failed:', error);
      alert('카테고리 삭제 중 오류가 발생했습니다');
    }
  };

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return '미분류';
    const category = categories.find((cat) => cat.id === categoryId);
    return category?.name || '미분류';
  };

  const canEditPost = (post: Post): boolean => {
    if (!currentUser) return false;

    // admin은 모든 글 수정 가능
    if (currentUser.role === 'admin') return true;

    // sub-admin은 admin이 작성한 글 제외하고 수정 가능
    if (currentUser.role === 'sub-admin') {
      const authorRole = authors[post.author_id]?.role;
      return authorRole !== 'admin';
    }

    // editor는 자기 글만 수정 가능
    if (currentUser.role === 'editor') {
      return currentUser.id === post.author_id;
    }

    return false;
  };

  const canDeletePost = (post: Post): boolean => {
    // 삭제 권한은 수정 권한과 동일
    return canEditPost(post);
  };

  const canPublishPost = (post: Post): boolean => {
    // 발행/취소 권한은 수정 권한과 동일
    return canEditPost(post);
  };

  const filteredPosts = posts
    .filter((post) => {
      // 발행 상태 필터
      if (filter === 'published' && !post.is_published) return false;
      if (filter === 'draft' && post.is_published) return false;

      // 카테고리 필터
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'uncategorized') {
          if (post.category_id !== null) return false;
        } else {
          if (post.category_id !== categoryFilter) return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      // 정렬
      switch (sortType) {
        case 'latest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'popular':
          return (b.view_count || 0) - (a.view_count || 0);
        default:
          return 0;
      }
    });

  const totalPages = Math.ceil(pagination.total / POSTS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">블로그 글 관리</h1>
            <p className="text-gray-600 mt-2">총 {pagination.total}개의 글</p>
          </div>
          <div className="flex items-center gap-3">
            {/* 정렬 드롭다운 */}
            <select
              value={sortType}
              onChange={(e) => setSortType(e.target.value as SortType)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="latest">최신순</option>
              <option value="oldest">오래된순</option>
              <option value="popular">인기순</option>
            </select>
            <Link
              href="/dashboard/contents/blog/create"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              새 글 작성
            </Link>
          </div>
        </div>

        {/* Filter */}
        <div className="space-y-4 mb-6">
          {/* 발행 상태 필터 */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilter('published')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'published'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              발행됨
            </button>
            <button
              onClick={() => setFilter('draft')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'draft'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              초안
            </button>
          </div>

          {/* 카테고리 필터 */}
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-4 py-2 rounded-lg transition text-sm ${
                categoryFilter === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              모든 카테고리
            </button>
            <button
              onClick={() => setCategoryFilter('uncategorized')}
              className={`px-4 py-2 rounded-lg transition text-sm ${
                categoryFilter === 'uncategorized'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              미분류
            </button>
            {categories.map((category) => (
              <div key={category.id} className="relative group">
                <button
                  onClick={() => setCategoryFilter(category.id)}
                  className={`px-4 py-2 pr-8 rounded-lg transition text-sm ${
                    categoryFilter === category.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {category.name}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCategory(category.id, category.name);
                  }}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                    categoryFilter === category.id
                      ? 'text-white hover:bg-purple-700'
                      : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title="카테고리 삭제"
                >
                  <i className="ri-close-line text-sm"></i>
                </button>
              </div>
            ))}

            {/* 카테고리 추가 버튼 */}
            {showAddCategory ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  placeholder="카테고리 이름"
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
                <button
                  onClick={handleAddCategory}
                  className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <i className="ri-check-line"></i>
                </button>
                <button
                  onClick={() => {
                    setShowAddCategory(false);
                    setNewCategoryName('');
                  }}
                  className="px-3 py-1.5 text-sm bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddCategory(true)}
                className="px-3 py-1.5 text-sm bg-white text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition flex items-center gap-1"
              >
                <i className="ri-add-line"></i>
                카테고리 추가
              </button>
            )}
          </div>
        </div>

        {/* Posts List */}
        {filteredPosts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 mb-4">작성된 글이 없습니다</p>
            <Link
              href="/dashboard/contents/blog/create"
              className="text-blue-600 hover:text-blue-700"
            >
              첫 번째 글을 작성해보세요
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-lg shadow hover:shadow-md transition overflow-hidden"
                >
                  <div className="flex">
                    {/* 썸네일 */}
                    <div className="w-48 h-32 bg-gray-100 flex-shrink-0">
                      {post.title_image_url ? (
                        <img
                          src={post.title_image_url}
                          alt={post.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <i className="ri-image-line text-4xl"></i>
                        </div>
                      )}
                    </div>

                    {/* 콘텐츠 */}
                    <div className="flex-1 p-6 flex flex-col justify-between">
                      <div>
                        {/* 카테고리 뱃지 */}
                        <div className="mb-2">
                          <span className="inline-block px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                            {getCategoryName(post.category_id)}
                          </span>
                        </div>

                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-xl font-semibold text-gray-900 flex-1">
                            {post.title}
                          </h3>

                          {/* 발행 토글 */}
                          {canPublishPost(post) ? (
                            <button
                              onClick={() => handleTogglePublish(post)}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ml-4 ${
                                post.is_published ? 'bg-green-600' : 'bg-gray-300'
                              }`}
                              role="switch"
                              aria-checked={post.is_published}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  post.is_published ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          ) : (
                            <div
                              className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent bg-gray-200 ml-4 opacity-50 cursor-not-allowed"
                              role="switch"
                              aria-checked={post.is_published}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  post.is_published ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </div>
                          )}
                        </div>

                        {post.subtitle && (
                          <p className="text-gray-600 text-sm mb-2">{post.subtitle}</p>
                        )}
                        {post.summary && (
                          <p className="text-gray-500 text-sm mb-3 line-clamp-2">{post.summary}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>
                            작성: {new Date(post.created_at).toLocaleDateString('ko-KR')}
                          </span>
                          {post.published_at && (
                            <span className="flex items-center gap-1">
                              <i className="ri-checkbox-circle-fill text-green-600"></i>
                              발행: {new Date(post.published_at).toLocaleDateString('ko-KR')}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <i className="ri-eye-line"></i>
                            조회수: {post.view_count || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <i className="ri-bookmark-line"></i>
                            스크랩: {post.scrap_count || 0}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {canEditPost(post) ? (
                            <Link
                              href={`/dashboard/contents/blog/${post.id}/edit`}
                              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                            >
                              수정
                            </Link>
                          ) : (
                            <span className="px-3 py-1.5 text-sm bg-gray-50 text-gray-400 rounded cursor-not-allowed">
                              수정
                            </span>
                          )}
                          {canDeletePost(post) ? (
                            <button
                              onClick={() => handleDelete(post.id)}
                              className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                            >
                              삭제
                            </button>
                          ) : (
                            <span className="px-3 py-1.5 text-sm bg-gray-50 text-gray-400 rounded cursor-not-allowed">
                              삭제
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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