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

export default function BlogListPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchPosts();
    fetchCategories();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/posts?type=blog');
      const data = await res.json();
      // 발행된 글만 필터링
      const publishedPosts = (data.data || []).filter((post: Post) => post.is_published);
      setPosts(publishedPosts);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
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
    if (selectedCategory === 'uncategorized') return post.category_id === null;
    return post.category_id === selectedCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Blog</h1>
          <p className="text-gray-600">총 {filteredPosts.length}개의 글</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Category Filter */}
        <div className="mb-8 flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg transition text-sm ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setSelectedCategory('uncategorized')}
            className={`px-4 py-2 rounded-lg transition text-sm ${
              selectedCategory === 'uncategorized'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            미분류
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg transition text-sm ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Posts Grid */}
        {filteredPosts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">작성된 글이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden group"
              >
                {/* Thumbnail - 16:9 비율 */}
                <div className="relative w-full aspect-video bg-gray-100 overflow-hidden">
                  {post.title_image_url ? (
                    <Image
                      src={post.title_image_url}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      priority={false}
                      placeholder="blur"
                      blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23f3f4f6' width='16' height='9'/%3E%3C/svg%3E"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <i className="ri-image-line text-5xl"></i>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  {/* Category Badge */}
                  <div className="mb-2">
                    <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                      {getCategoryName(post.category_id)}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition">
                    {post.title}
                  </h2>

                  {/* Subtitle */}
                  {post.subtitle && (
                    <p className="text-gray-600 text-sm mb-2 line-clamp-1">{post.subtitle}</p>
                  )}

                  {/* Summary */}
                  {post.summary && (
                    <p className="text-gray-500 text-sm mb-4 line-clamp-3">{post.summary}</p>
                  )}

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
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
        )}
      </div>
    </div>
  );
}