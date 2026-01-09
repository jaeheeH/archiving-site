'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { createClient } from '@/lib/supabase/client';

import { ReadOnlyImageGalleryNode } from '@/components/Editor/ReadOnlyImageGalleryNode';
import { ReadOnlyColumnsNode } from '@/components/Editor/ReadOnlyColumnsNode';
import { optimizeImageUrl } from '@/lib/image-optimizer';
import '../../css/blog/view.scss';

// 인터페이스 정의
export interface Post {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  content: any;
  slug: string;
  published_at: string | null;
  created_at: string;
  title_image_url: string | null;
  category_id: string | null;
  view_count: number;
  scrap_count: number;
  userScraped: boolean; // 서버에서 올 때는 기본적으로 false일 수 있음 (ISR 특성상)
}

interface Category {
  id: string;
  name: string;
}

interface BlogDetailClientProps {
  initialPost: Post;
}

// ---------------------------------------------------------
// 유틸리티: 조회 기록 관리 (LocalStorage)
// ---------------------------------------------------------
const ViewedPostsManager = {
  KEY: 'viewed_posts_24h',

  getViewedPosts(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(this.KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to get viewed posts:', error);
      return {};
    }
  },

  isViewedWithin24Hours(slug: string): boolean {
    const viewedPosts = this.getViewedPosts();
    const lastViewTime = viewedPosts[slug];
    if (!lastViewTime) return false;

    const now = new Date().getTime();
    const lastView = new Date(lastViewTime).getTime();
    const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

    return now - lastView < twentyFourHoursInMs;
  },

  recordView(slug: string): void {
    const viewedPosts = this.getViewedPosts();
    viewedPosts[slug] = new Date().toISOString();
    try {
      localStorage.setItem(this.KEY, JSON.stringify(viewedPosts));
    } catch (error) {
      console.error('Failed to save viewed posts:', error);
    }
  },

  cleanupExpiredRecords(): void {
    const viewedPosts = this.getViewedPosts();
    const now = new Date().getTime();
    const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

    Object.entries(viewedPosts).forEach(([slug, timestamp]) => {
      const lastView = new Date(timestamp).getTime();
      if (now - lastView >= twentyFourHoursInMs) {
        delete viewedPosts[slug];
      }
    });

    try {
      localStorage.setItem(this.KEY, JSON.stringify(viewedPosts));
    } catch (error) {
      console.error('Failed to cleanup expired records:', error);
    }
  },
};

// ---------------------------------------------------------
// 메인 컴포넌트
// ---------------------------------------------------------
export default function BlogDetailClient({ initialPost }: BlogDetailClientProps) {
  const router = useRouter();
  
  // ✅ Props로 받은 데이터로 초기 상태 설정 (로딩 불필요)
  const [post, setPost] = useState<Post>(initialPost);
  const [category, setCategory] = useState<Category | null>(null);
  
  // ISR 페이지이므로 userScraped의 초기값은 정확하지 않을 수 있음 (일단 false나 props값으로 시작)
  const [isScraped, setIsScraped] = useState(initialPost.userScraped || false);
  const [scrapCount, setScrapCount] = useState(initialPost.scrap_count || 0);
  const [viewCount, setViewCount] = useState(initialPost.view_count || 0);
  
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [hasRecordedView, setHasRecordedView] = useState(false);
  const [isScrapping, setIsScrapping] = useState(false);

  // Tiptap 에디터 설정
  const editor = useEditor({
    extensions: [
      StarterKit as any,
      ImageExtension,
      ReadOnlyImageGalleryNode,
      ReadOnlyColumnsNode,
      Table.configure({
        resizable: true,
        handleWidth: 4,
        cellMinWidth: 50,
        lastColumnResizable: true,
        allowTableNodeSelection: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: true,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph', 'image', 'imageGallery'],
      }),
    ],
    editable: false,
    immediatelyRender: false,
    content: initialPost.content, // ✅ 초기 콘텐츠 바로 주입
  });

  // 1. 사용자 정보 가져오기
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // 2. 카테고리 정보 가져오기 (필요하다면 이 부분도 서버에서 가져와 props로 넘길 수 있음)
  useEffect(() => {
    if (post?.category_id) {
      fetchCategory(post.category_id);
    }
  }, [post?.category_id]);

  // 3. [중요] 로그인 유저일 경우, 최신 스크랩 상태 동기화 (ISR 보완)
  useEffect(() => {
    if (user && post.slug) {
      // 이미 화면은 보이고 있으므로, 백그라운드에서 조용히 내 상태만 업데이트
      fetch(`/api/posts/by-slug/${post.slug}`)
        .then((res) => {
           if(res.ok) return res.json();
           throw new Error('Fetch failed');
        })
        .then((data) => {
          // 내 스크랩 상태와 최신 스크랩/조회수 카운트 동기화
          setIsScraped(data.userScraped);
          setScrapCount(data.scrap_count);
          // setViewCount(data.view_count); // 조회수는 아래 recordView에서 처리하므로 생략 가능
        })
        .catch((err) => console.error('Background update failed:', err));
    }
  }, [user, post.slug]);

  // 4. 조회수 기록
  useEffect(() => {
    if (post && !hasRecordedView) {
      recordView();
      setHasRecordedView(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, hasRecordedView]); // post 객체가 변경되는 것을 방지하기 위해 ID 의존

  // 5. 에디터 콘텐츠 동기화 (혹시 모를 타이밍 문제 방지)
  useEffect(() => {
    if (post?.content && editor && editor.isEmpty) {
      editor.commands.setContent(post.content);
    }
  }, [post.content, editor]);

  // 6. 이미지 최적화 (기존 로직 유지)
  useEffect(() => {
    const optimizeEditorImages = () => {
      try {
        const images = document.querySelectorAll('.tiptap-content img');
        if (images.length === 0) return;

        images.forEach((img: Element) => {
          const src = img.getAttribute('src');
          if (src && src.includes('supabase.co')) {
            const optimizedSrc = optimizeImageUrl(src, {
              width: 1000,
              format: 'webp',
              quality: 75,
            });

            const srcset = [
              `${optimizeImageUrl(src, { width: 400, format: 'webp', quality: 75 })} 400w`,
              `${optimizeImageUrl(src, { width: 800, format: 'webp', quality: 75 })} 800w`,
              `${optimizeImageUrl(src, { width: 1200, format: 'webp', quality: 75 })} 1200w`,
            ].join(', ');

            img.setAttribute('src', optimizedSrc);
            img.setAttribute('srcset', srcset);
            img.setAttribute('sizes', '(max-width: 640px) 100vw, (max-width: 1024px) 800px, 1200px');
            img.setAttribute('loading', 'lazy');
            img.setAttribute('decoding', 'async');
          }
        });
      } catch (error) {
        console.warn('Image optimization failed:', error);
      }
    };

    const timer = setTimeout(optimizeEditorImages, 300);
    return () => clearTimeout(timer);
  }, [post?.content, editor]); // editor 의존성 추가

  // --- Functions ---

  const fetchCurrentUser = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    }
  };

  const fetchCategory = async (categoryId: string) => {
    try {
      // 카테고리는 자주 안 바뀌므로 그대로 유지
      const res = await fetch('/api/posts/categories?type=blog');
      const data = await res.json();
      const foundCategory = (data.categories || []).find((c: Category) => c.id === categoryId);
      setCategory(foundCategory || null);
    } catch (error) {
      console.error('Failed to fetch category:', error);
    }
  };

  const recordView = async () => {
    if (!post) return;
    ViewedPostsManager.cleanupExpiredRecords();

    // 로그인 여부와 관계없이 API 호출은 하지만,
    // 클라이언트 상태(localStorage/State)로 중복 체크
    if (user) {
      try {
        const res = await fetch(`/api/posts/${post.id}/view`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
           // 서버가 증가시켰는지 여부와 상관없이 최신 카운트 반영
           if(data.viewCount) setViewCount(data.viewCount);
        }
      } catch (error) {
        console.error('로그인 사용자 조회수 기록 실패:', error);
      }
    } else {
      // 비로그인
      if (ViewedPostsManager.isViewedWithin24Hours(post.slug)) {
        return;
      }
      ViewedPostsManager.recordView(post.slug);
      try {
        const res = await fetch(`/api/posts/${post.id}/view`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.viewCount) {
          setViewCount(data.viewCount);
        }
      } catch (error) {
        console.error('비로그인 사용자 조회수 기록 실패:', error);
      }
    }
  };

  const handleScrapToggle = async () => {
    if (!user) {
      alert('로그인이 필요합니다');
      router.push(`/auth/login?redirect=${window.location.pathname}`);
      return;
    }
    if (!post || isScrapping) return;

    try {
      setIsScrapping(true);
      const res = await fetch(`/api/posts/${post.id}/scrap`, { method: 'POST' });

      if (res.status === 401) {
        alert('로그인이 필요합니다');
        router.push(`/auth/login?redirect=${window.location.pathname}`);
        return;
      }

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || '오류가 발생했습니다');
        return;
      }

      const data = await res.json();
      setIsScraped(data.scraped);
      setScrapCount(data.scrapCount);
    } catch (error) {
      console.error('Failed to toggle scrap:', error);
      alert('오류가 발생했습니다');
    } finally {
      setIsScrapping(false);
    }
  };

  // ✅ post가 없을 때(null) 처리는 상위 컴포넌트(page.tsx)에서 처리하거나
  // ISR 데이터가 확실히 넘어오므로 여기서는 바로 렌더링합니다.
  if (!post) return null;

  return (
    <div className="min-h-screen">
      {/* Header Image */}
      {post.title_image_url && (
        <div className="relative max-w-4xl mx-auto h-56 md:h-80 lg:h-96 bg-gray-200 overflow-hidden">
          <Image
            src={post.title_image_url}
            alt={post.title}
            fill
            sizes="100vw"
            className="object-cover"
            priority
            quality={75}
            placeholder="blur"
            blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23d1d5db' width='16' height='9'/%3E%3C/svg%3E"
          />
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto py-12 article-editor">
        {/* Category */}
        {category && (
          <div className="mb-4">
            <span className="inline-block px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded">
              {category.name}
            </span>
          </div>
        )}

        {/* Subtitle */}
        {post.subtitle && (
          <p className="text-gray-600 mb-2">{post.subtitle}</p>
        )}

        {/* Title */}
        <h1 className="text-2xl md:text-2xl font-bold text-gray-900 mb-4">
          {post.title}
        </h1>

        {/* Summary */}
        {post.summary && (
          <p className="text-gray-600 mb-6">{post.summary}</p>
        )}

        {/* Meta Info */}
        <div className="flex items-center justify-between text-sm text-gray-500 mb-8 pb-8 border-b flex-wrap gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <span>
              {new Date(post.published_at || post.created_at).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span className="flex items-center gap-1">
              <i className="ri-eye-line"></i>
              조회 {viewCount}
            </span>
          </div>

          {/* 스크랩 버튼 */}
          <button
            onClick={handleScrapToggle}
            disabled={isScrapping}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              isScraped
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <i className={`ri-bookmark-${isScraped ? 'fill' : 'line'}`}></i>
            <span>스크랩 {scrapCount}</span>
          </button>
        </div>

        {/* Article Content */}
        <article className="prose prose-lg max-w-none">
          <div className="tiptap-content">
            <EditorContent editor={editor} />
          </div>
        </article>

        {/* Back Button */}
        <div className="mt-12 pt-8 border-t">
          <button
            onClick={() => router.push('/blog')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center gap-2"
          >
            <i className="ri-arrow-left-line"></i>
            목록으로
          </button>
        </div>
      </div>
    </div>
  );
}