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

// --- Types ---
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
  userScraped: boolean; 
}

interface Category {
  id: string;
  name: string;
}

interface BlogDetailClientProps {
  initialPost: Post;
}

// --- Utility: LocalStorage Manager for Guests ---
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

    let changed = false;
    Object.entries(viewedPosts).forEach(([slug, timestamp]) => {
      const lastView = new Date(timestamp).getTime();
      if (now - lastView >= twentyFourHoursInMs) {
        delete viewedPosts[slug];
        changed = true;
      }
    });

    if (changed) {
      try {
        localStorage.setItem(this.KEY, JSON.stringify(viewedPosts));
      } catch (error) {
        console.error('Failed to cleanup expired records:', error);
      }
    }
  },
};

// --- Main Component ---
export default function BlogDetailClient({ initialPost }: BlogDetailClientProps) {
  const router = useRouter();
  
  // ✅ Props로 받은 초기 데이터 사용
  const [post, setPost] = useState<Post>(initialPost);
  const [category, setCategory] = useState<Category | null>(null);
  
  // 상태 관리
  const [isScraped, setIsScraped] = useState(initialPost.userScraped || false);
  const [scrapCount, setScrapCount] = useState(initialPost.scrap_count || 0);
  const [viewCount, setViewCount] = useState(initialPost.view_count || 0);
  
  // 인증 및 조회수 관련 상태
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false); // 인증 체크 완료 여부
  const [hasRecordedView, setHasRecordedView] = useState(false); // 조회수 증가 실행 여부
  const [isScrapping, setIsScrapping] = useState(false);

  // TipTap Editor 설정
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
    content: initialPost.content,
  });

  // 1️⃣ [Auth Check] 사용자 정보 확인 (가장 먼저 실행)
  useEffect(() => {
    const initAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setIsAuthChecked(true); // 유저 유무와 관계없이 체크 완료
      }
    };
    initAuth();
  }, []);

  // 2️⃣ [Category] 카테고리 정보 가져오기
  useEffect(() => {
    const fetchCategory = async () => {
      if (!post?.category_id) return;
      try {
        const res = await fetch('/api/posts/categories?type=blog');
        const data = await res.json();
        const foundCategory = (data.categories || []).find((c: Category) => c.id === post.category_id);
        setCategory(foundCategory || null);
      } catch (error) {
        console.error('Failed to fetch category:', error);
      }
    };
    fetchCategory();
  }, [post?.category_id]);

  // 3️⃣ [Sync User Data] 로그인 유저의 최신 상태(스크랩 등) 동기화
  useEffect(() => {
    if (user && post.slug) {
      // ISR 데이터에는 '내 스크랩 여부'가 없을 수 있으므로 클라이언트에서 확인
      fetch(`/api/posts/by-slug/${post.slug}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            setIsScraped(data.userScraped);
            setScrapCount(data.scrap_count);
            // viewCount는 아래 recordView에서 처리하므로 여기서 굳이 덮어씌우지 않아도 됨
          }
        })
        .catch((err) => console.error('Background sync failed:', err));
    }
  }, [user, post.slug]);

  // 4️⃣ [Record View] 조회수 기록 (인증 체크 완료 후 실행)
  useEffect(() => {
    // 인증 체크가 끝났고 && 포스트가 있고 && 아직 기록 안 했다면
    if (isAuthChecked && post && !hasRecordedView) {
      recordView();
      setHasRecordedView(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthChecked, post?.id, hasRecordedView]);

  // 5️⃣ [Image Opt] 에디터 이미지 최적화
  useEffect(() => {
    const optimizeEditorImages = () => {
      try {
        const images = document.querySelectorAll('.tiptap-content img');
        if (images.length === 0) return;

        images.forEach((img: Element) => {
          const src = img.getAttribute('src');
          if (src && src.includes('supabase.co')) {
            const optimizedSrc = optimizeImageUrl(src, { width: 1000, format: 'webp', quality: 75 });
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
  }, [post?.content, editor]);

  // --- Helper Functions ---

  const recordView = async () => {
    if (!post) return;
    
    // 만료된 기록 청소
    ViewedPostsManager.cleanupExpiredRecords();

    // A. 로그인 회원: LocalStorage 체크 없이 서버로 요청 (서버 정책 따름)
    if (user) {
      try {
        const res = await fetch(`/api/posts/${post.id}/view`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.viewCount) {
          console.log('✅ 회원 조회수 증가:', data.viewCount);
          setViewCount(data.viewCount);
        }
      } catch (error) {
        console.error('회원 조회수 기록 실패:', error);
      }
    } 
    // B. 비회원(게스트): LocalStorage로 24시간 중복 체크
    else {
      // 이미 24시간 내에 본 적이 있다면 스킵
      if (ViewedPostsManager.isViewedWithin24Hours(post.slug)) {
        console.log('🚫 게스트 중복 조회 (Skip)');
        return;
      }

      // 처음 봄 -> LocalStorage에 기록
      ViewedPostsManager.recordView(post.slug);

      // 서버로 조회수 증가 요청
      try {
        const res = await fetch(`/api/posts/${post.id}/view`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.viewCount) {
          console.log('✅ 게스트 조회수 증가:', data.viewCount);
          setViewCount(data.viewCount);
        }
      } catch (error) {
        console.error('게스트 조회수 기록 실패:', error);
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

      {/* Content Container */}
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

        {/* Meta Info Bar */}
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

          {/* Scrap Button */}
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

        {/* Article Body */}
        <article className="prose prose-lg max-w-none">
          <div className="tiptap-content">
            <EditorContent editor={editor} />
          </div>
        </article>

        {/* Navigation */}
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