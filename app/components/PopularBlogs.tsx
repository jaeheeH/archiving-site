// components/PopularBlogs.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  view_count: number;
  published_at: string;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

export default function PopularBlogs() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // 카테고리 로드
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('categories')
          .select('id, name')
          .eq('type', 'blog');

        if (error) throw error;

        const categoryMap = new Map<string, string>();
        (data || []).forEach((cat: Category) => {
          categoryMap.set(cat.id, cat.name);
        });
        setCategories(categoryMap);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };

    fetchCategories();
  }, []);

  // 인기 블로그 로드 (조회수 기준)
  useEffect(() => {
    const fetchPopularBlogs = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('posts')
          .select('id, title, slug, view_count, published_at, category_id')
          .eq('is_published', true)
          .order('view_count', { ascending: false })
          .limit(5);

        if (error) throw error;
        setPosts(data || []);
      } catch (error) {
        console.error('Failed to fetch popular blogs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPopularBlogs();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 ">
        <div className="h-6 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6 mainPopularBlog">
      {/* 제목 */}
      <div className='mb-6'>
        <h2 className="text-xl font-bold">인기 콘텐츠</h2>
      </div>

      {/* 블로그 목록 */}
      <div className="space-y-4 mainPopularBlogItems">
        {posts.map((post, index) => {
          const categoryName = post.category_id
            ? categories.get(post.category_id)
            : null;
          const publishDate = new Date(post.published_at || '').toLocaleDateString(
            'ko-KR',
            {
              month: 'short',
              day: 'numeric',
            }
          );

          return (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="block group"
            >
              <div className="flex gap-4 pb-4 border-b border-gray-200 hover:border-gray-400 transition">
                {/* 번호 */}
                <div className="flex-shrink-0 w-8 text-center">
                  <p className="text-lg font-bold text-gray-400 text-primary">
                    0{index + 1}
                  </p>
                </div>

                {/* 콘텐츠 */}
                <div className="flex-1 min-w-0">

                  {/* 제목 */}
                  <h3 className=" text-gray-900 group-hover:text-blue-600 transition line-clamp-2 ">
                    {post.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-2 line-clamp-1">{categoryName} {publishDate}</p>

                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <div className='popularLinkBtn'>
        <Link
        href={`/blog`}
        className='text-right'
        >
          <p className='text-gray-900 hover:text-[#ff4800] '>View All Blog &rarr;</p>
        </Link>
      </div>
    </div>
  );
}