'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import NextLink from 'next/link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { createClient } from '@/lib/supabase/client';
import type { AnyExtension, JSONContent } from '@tiptap/core';

import { ReadOnlyImageGalleryNode } from '@/components/Editor/ReadOnlyImageGalleryNode';
import { ReadOnlyColumnsNode } from '@/components/Editor/ReadOnlyColumnsNode';
import { optimizeImageUrl } from '@/lib/image-optimizer';
import { normalizeAvatarUrl } from '@/lib/avatar-url';
import '../../css/blog/view.scss';

// 인터페이스 정의
type TiptapContent = JSONContent | JSONContent[] | string | null;

export interface Post {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  content: TiptapContent;
  slug: string;
  published_at: string | null;
  created_at: string;
  title_image_url: string | null;
  category_id: string | null;
  view_count: number;
  scrap_count: number;
  author_id: string | null;
  userScraped: boolean; // 서버에서 올 때는 기본적으로 false일 수 있음 (ISR 특성상)
}

interface Category {
  id: string;
  name: string;
}

interface AuthorProfile {
  id: string;
  nickname: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface RelatedPost {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  slug: string;
  published_at: string | null;
  created_at: string;
  title_image_url: string | null;
  category_id: string | null;
}

interface BlogDetailClientProps {
  initialPost: Post;
  initialCategory?: Category | null;
  initialAuthorProfile?: AuthorProfile | null;
  initialRelatedPosts?: RelatedPost[];
}

interface ArticleHeading {
  id: string;
  level: number;
  text: string;
}

const getNodeText = (node: TiptapContent): string => {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.content)) return '';
  return node.content.map(getNodeText).join('');
};

const createHeadingId = (text: string, index: number) => {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);

  return slug || `section-${index + 1}`;
};

const extractHeadings = (content: TiptapContent): ArticleHeading[] => {
  const headings: ArticleHeading[] = [];
  const seenIds = new Map<string, number>();

  const visit = (node: TiptapContent) => {
    if (!node) return;
    if (typeof node === 'string') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.type === 'heading' && [2, 3].includes(node.attrs?.level)) {
      const text = getNodeText(node).trim();
      if (text) {
        const baseId = createHeadingId(text, headings.length);
        const seenCount = seenIds.get(baseId) || 0;
        seenIds.set(baseId, seenCount + 1);

        headings.push({
          id: seenCount > 0 ? `${baseId}-${seenCount + 1}` : baseId,
          level: Number(node.attrs?.level || 2),
          text,
        });
      }
    }

    if (Array.isArray(node.content)) {
      node.content.forEach(visit);
    }
  };

  visit(content);
  return headings;
};

const extractSummaryItems = (text: string | null | undefined): string[] => {
  if (!text) return [];

  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
};

const formatCompactDate = (dateValue: string | null | undefined) =>
  new Date(dateValue || new Date()).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

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
export default function BlogDetailClient({
  initialPost,
  initialCategory = null,
  initialAuthorProfile = null,
  initialRelatedPosts = [],
}: BlogDetailClientProps) {
  const router = useRouter();
  
  // ✅ Props로 받은 데이터로 초기 상태 설정 (로딩 불필요)
  const [post] = useState<Post>(initialPost);
  const [category, setCategory] = useState<Category | null>(initialCategory);
  const [authorProfile, setAuthorProfile] = useState<AuthorProfile | null>(initialAuthorProfile);
  
  // ISR 페이지이므로 userScraped의 초기값은 정확하지 않을 수 있음 (일단 false나 props값으로 시작)
  const [isScraped, setIsScraped] = useState(initialPost.userScraped || false);
  const [scrapCount, setScrapCount] = useState(initialPost.scrap_count || 0);
  const [viewCount, setViewCount] = useState(initialPost.view_count || 0);
  const [copied, setCopied] = useState(false);
  
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [hasRecordedView, setHasRecordedView] = useState(false);
  const [isScrapping, setIsScrapping] = useState(false);
  const headings = useMemo(() => extractHeadings(post.content), [post.content]);
  const readingMinutes = useMemo(() => {
    const textLength = getNodeText(post.content).replace(/\s+/g, '').length;
    return Math.max(1, Math.ceil(textLength / 600));
  }, [post.content]);
  const summaryItems = useMemo(
    () => extractSummaryItems(post.summary || post.subtitle),
    [post.summary, post.subtitle]
  );

  // Tiptap 에디터 설정
  const editor = useEditor({
    extensions: [
      StarterKit as unknown as AnyExtension,
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
    // eslint-disable-next-line react-hooks/immutability, react-hooks/set-state-in-effect
    fetchCurrentUser();
  }, []);

  // 2. 카테고리 정보 가져오기 (ISR 초기 데이터가 없을 때만 보완)
  useEffect(() => {
    if (post?.category_id && !category) {
      // eslint-disable-next-line react-hooks/immutability, react-hooks/set-state-in-effect
      fetchCategory(post.category_id);
    }
  }, [post?.category_id, category]);

  useEffect(() => {
    if (post?.author_id && !authorProfile) {
      // eslint-disable-next-line react-hooks/immutability, react-hooks/set-state-in-effect
      fetchAuthorProfile(post.author_id);
    }
  }, [post?.author_id, authorProfile]);

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
      // eslint-disable-next-line react-hooks/immutability, react-hooks/set-state-in-effect
      recordView();
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  useEffect(() => {
    const timer = setTimeout(() => {
      const elements = Array.from(document.querySelectorAll('.tiptap-content h2, .tiptap-content h3'));
      elements.forEach((element, index) => {
        const heading = headings[index];
        if (heading) element.setAttribute('id', heading.id);
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [headings, editor]);

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
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
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

  const fetchAuthorProfile = async (authorId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('users')
        .select('id, nickname, name, avatar_url')
        .eq('id', authorId)
        .single();

      if (error) throw error;
      setAuthorProfile(data ? { ...data, avatar_url: normalizeAvatarUrl(data.avatar_url) } : null);
    } catch (error) {
      console.error('Failed to fetch author profile:', error);
      setAuthorProfile(null);
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
      const redirectTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      router.push(`/login?redirect=${redirectTo}`);
      return;
    }
    if (!post || isScrapping) return;

    try {
      setIsScrapping(true);
      const res = await fetch(`/api/posts/${post.id}/scrap`, { method: 'POST' });

      if (res.status === 401) {
        alert('로그인이 필요합니다');
        const redirectTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
        router.push(`/login?redirect=${redirectTo}`);
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error('Failed to copy link:', error);
      const textarea = document.createElement('textarea');
      textarea.value = window.location.href;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  // ✅ post가 없을 때(null) 처리는 상위 컴포넌트(page.tsx)에서 처리하거나
  // ISR 데이터가 확실히 넘어오므로 여기서는 바로 렌더링합니다.
  if (!post) return null;

  const publishedLabel = new Date(post.published_at || post.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const categoryName = category?.name || 'Article';
  const authorName = authorProfile?.nickname || authorProfile?.name || 'ARCH.B';
  const authorInitial = authorName.charAt(0).toUpperCase();

  return (
    <div className="archive-article min-h-screen bg-[var(--archive-canvas)] text-[var(--archive-ink)]">
      <article>
        <header className="border-b border-[var(--archive-line)]">
          <div className="mx-auto max-w-[var(--archive-page)] px-4 py-12 lg:py-16">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-[12px] text-[var(--archive-muted)]">
              <NextLink href="/blog" className="font-semibold transition-colors hover:text-[var(--archive-brand)]">
                Blog
              </NextLink>
              {post.category_id && (
                <>
                  <span className="text-[var(--archive-faint)]">/</span>
                  <NextLink
                    href={`/blog?category=${post.category_id}`}
                    className="font-semibold transition-colors hover:text-[var(--archive-brand)]"
                  >
                    {categoryName}
                  </NextLink>
                </>
              )}
            </div>

            <h1 className="max-w-[880px] text-[31px] font-extrabold leading-[1.22] tracking-tight md:text-[40px] lg:text-[46px]">
              {post.title}
            </h1>

            <div className="mt-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--archive-line)] text-[15px] font-bold">
                  {authorProfile?.avatar_url ? (
                    <Image
                      src={authorProfile.avatar_url}
                      alt={authorName}
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  ) : (
                    authorInitial
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold leading-tight text-[var(--archive-ink)]">{authorName}</p>
                  <p className="archive-index mt-1 text-[12px] text-[var(--archive-muted)]">
                    {publishedLabel} · {readingMinutes}분 분량
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[12px] text-[var(--archive-muted)]">
                <span className="flex items-center gap-1.5" title="조회수">
                  <i className="ri-eye-line text-[15px]" />
                  <span className="archive-index">{viewCount}</span>
                </span>
                <button
                  type="button"
                  onClick={handleScrapToggle}
                  disabled={isScrapping}
                  className="flex items-center gap-1.5 transition-colors hover:text-[var(--archive-brand)] disabled:opacity-50"
                  aria-label="북마크"
                  title="북마크"
                >
                  <i className={`ri-bookmark-${isScraped ? 'fill' : 'line'} text-[14px]`} />
                  <span className="archive-index">{scrapCount}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 transition-colors hover:text-[var(--archive-brand)]"
                  aria-label="링크 복사"
                  title="링크 복사"
                >
                  <i className="ri-link text-[15px]" />
                  <span>{copied ? '복사됨' : '링크 복사'}</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[var(--archive-page)] px-4">
          {post.title_image_url && (
            <div className="my-10 lg:my-12">
              <div className="relative aspect-[16/9] overflow-hidden bg-[var(--archive-bg-light)]">
                <Image
                  src={post.title_image_url}
                  alt={post.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 1040px"
                  className="object-cover"
                  priority
                  quality={75}
                  placeholder="blur"
                  blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23f5f5f5' width='16' height='9'/%3E%3C/svg%3E"
                />
              </div>
            </div>
          )}

          {summaryItems.length > 0 && (
            <section className="archive-article-summary py-4">
              <div className="mb-4 flex items-center gap-2">
                <i className="ri-flashlight-line text-[17px] text-[var(--archive-brand)]" />
                <p className="archive-eyebrow text-[var(--archive-faint)]">한눈에 보는 핵심요약</p>
              </div>
              <ul className="space-y-2.5">
                {summaryItems.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-3 text-[15px] leading-7 text-[var(--archive-ink)]">
                    <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--archive-brand)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid grid-cols-1 gap-10 pb-20 pt-10 lg:grid-cols-[1fr_320px] lg:gap-12 lg:pt-14">
            <main className="min-w-0">
              <div className="article-editor archive-article-body">
                <div className="tiptap-content">
                  <EditorContent editor={editor} />
                </div>
              </div>

              <div className="mt-12 flex items-center justify-between">
                <p className="archive-eyebrow text-[var(--archive-faint)]">Share</p>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--archive-muted)] transition-colors hover:text-[var(--archive-brand)]"
                  aria-label="링크 복사"
                  title={copied ? '복사됨' : '링크 복사'}
                >
                  <i className={`${copied ? 'ri-check-line' : 'ri-link'} text-[16px]`} />
                </button>
              </div>

              <div className="mt-14 flex gap-4 lg:hidden">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--archive-line)] text-base font-bold">
                  {authorProfile?.avatar_url ? (
                    <Image
                      src={authorProfile.avatar_url}
                      alt={authorName}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    authorInitial
                  )}
                </div>
                <div className="flex-1">
                  <p className="archive-eyebrow mb-1 text-[var(--archive-faint)]">Written by</p>
                  <p className="mb-2 text-lg font-bold">{authorName}</p>
                  <p className="text-[14px] leading-6 text-[var(--archive-muted)]">
                    디자인과 기술 사이에서 발견한 흐름을 기록합니다.
                  </p>
                </div>
              </div>

              {initialRelatedPosts.length > 0 && (
                <section className="mt-16 border-y border-[var(--archive-line)] py-8">
                  <div className="mb-6 flex items-end justify-between gap-4">
                    <div>
                      <p className="archive-eyebrow mb-2 text-[var(--archive-faint)]">Related</p>
                      <h2 className="text-[22px] font-extrabold tracking-tight">함께 읽기 좋은 글</h2>
                    </div>
                    <NextLink
                      href={post.category_id ? `/blog?category=${post.category_id}` : "/blog"}
                      className="hidden text-[12px] font-semibold text-[var(--archive-muted)] transition-colors hover:text-[var(--archive-brand)] sm:inline-flex"
                    >
                      더 보기
                    </NextLink>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    {initialRelatedPosts.map((related) => (
                      <NextLink
                        key={related.id}
                        href={`/blog/${related.slug}`}
                        className="group block min-w-0"
                      >
                        <div className="relative mb-4 aspect-[4/3] overflow-hidden bg-[var(--archive-bg-light)]">
                          {related.title_image_url ? (
                            <Image
                              src={related.title_image_url}
                              alt={related.title}
                              fill
                              sizes="(max-width: 768px) 100vw, 33vw"
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--archive-faint)]">
                              ARCH-B
                            </div>
                          )}
                        </div>
                        <p className="archive-eyebrow mb-2 text-[var(--archive-brand)]">
                          {related.category_id === post.category_id ? categoryName : "Blog"}
                        </p>
                        <h3 className="line-clamp-2 text-[16px] font-bold leading-6 transition-colors group-hover:text-[var(--archive-brand)]">
                          {related.title}
                        </h3>
                        <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[var(--archive-muted)]">
                          {related.summary || related.subtitle || "다음 글에서 이어지는 인사이트를 확인해보세요."}
                        </p>
                        <p className="archive-index mt-3 text-[12px] text-[var(--archive-faint)]">
                          {formatCompactDate(related.published_at || related.created_at)}
                        </p>
                      </NextLink>
                    ))}
                  </div>
                </section>
              )}

              <div className="mt-12">
                <button
                  type="button"
                  onClick={() => router.push('/blog')}
                  className="inline-flex items-center gap-2 border border-[var(--archive-line)] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] transition-colors hover:border-[var(--archive-brand)] hover:bg-[var(--archive-brand)] hover:text-white"
                >
                  <i className="ri-arrow-left-line text-[15px]" />
                  목록으로
                </button>
              </div>
            </main>

            <aside className="hidden lg:block">
              <div className="sticky top-[100px] space-y-10">
                <section>
                  <p className="archive-eyebrow mb-4 text-[var(--archive-faint)]">Article</p>
                  <dl className="space-y-3 text-[13px] leading-5">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-[var(--archive-muted)]">Published</dt>
                      <dd className="archive-index text-right font-medium">{publishedLabel}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-[var(--archive-muted)]">Category</dt>
                      <dd className="text-right font-medium">{categoryName}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-[var(--archive-muted)]">Read</dt>
                      <dd className="archive-index text-right font-medium">{readingMinutes}분</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-[var(--archive-muted)]">Views</dt>
                      <dd className="archive-index text-right font-medium">{viewCount}</dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <p className="archive-eyebrow mb-4 text-[var(--archive-faint)]">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-2 border border-[var(--archive-line)] px-3 py-2 text-[12px] font-semibold transition-colors hover:border-[var(--archive-brand)] hover:text-[var(--archive-brand)]"
                    >
                      <i className={`${copied ? 'ri-check-line' : 'ri-link'} text-[15px]`} />
                      {copied ? '복사됨' : '링크 복사'}
                    </button>
                    <button
                      type="button"
                      onClick={handleScrapToggle}
                      disabled={isScrapping}
                      className="inline-flex items-center gap-2 border border-[var(--archive-line)] px-3 py-2 text-[12px] font-semibold transition-colors hover:border-[var(--archive-brand)] hover:text-[var(--archive-brand)] disabled:opacity-50"
                    >
                      <i className={`ri-bookmark-${isScraped ? 'fill' : 'line'} text-[15px]`} />
                      북마크
                    </button>
                  </div>
                </section>

                <section>
                  <p className="archive-eyebrow mb-4 text-[var(--archive-faint)]">Written by</p>
                  <div className="flex items-start gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--archive-line)] text-[14px] font-bold">
                      {authorProfile?.avatar_url ? (
                        <Image
                          src={authorProfile.avatar_url}
                          alt={authorName}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        authorInitial
                      )}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold">{authorName}</p>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--archive-muted)]">
                        디자인과 기술 사이에서 발견한 흐름을 기록합니다.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </div>
      </article>
    </div>
  );
}
