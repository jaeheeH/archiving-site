'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import NextLink from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { JSONContent } from '@tiptap/core';
import type { ArticleHeading } from '@/lib/article-outline';
import ArchiveImage from '@/app/components/ArchiveImage';

import { normalizeAvatarUrl } from '@/lib/avatar-url';
import { SITE_COPY } from '@/lib/site-copy';
import { CATEGORIES } from '@/lib/news-feeds';
import '../../css/blog/view.scss';

// 인터페이스 정의
type TiptapContent = JSONContent | JSONContent[] | string | null;

export interface Post {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  content?: TiptapContent;
  slug: string;
  published_at: string | null;
  created_at: string;
  title_image_url: string | null;
  category_id: string | null;
  view_count: number;
  scrap_count: number;
  author_id: string | null;
  like_count?: number;
  userLiked?: boolean;
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
  type?: string;
  content?: { category?: keyof typeof CATEGORIES };
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
  news?: {
    categoryName: string;
    categoryUrl: string;
    source: string;
    description: string;
    points: string[];
    readingMinutes: number;
  };
  children?: ReactNode;
  outline?: { headings: ArticleHeading[]; readingMinutes: number };
}

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
  news,
  children,
  outline = { headings: [], readingMinutes: 1 },
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
  const [isLiked, setIsLiked] = useState(initialPost.userLiked || false);
  const [likeCount, setLikeCount] = useState(initialPost.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [reactionError, setReactionError] = useState('');
  const [likesAvailable, setLikesAvailable] = useState(false);
  
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const accountId = useRef<string | null>(null);
  const [hasRecordedView, setHasRecordedView] = useState(false);
  const [isScrapping, setIsScrapping] = useState(false);
  const headings = outline.headings;
  const editorialReadingMinutes = outline.readingMinutes;
  const summaryItems = useMemo(
    () => news?.points || extractSummaryItems(post.summary || post.subtitle),
    [news, post.summary, post.subtitle]
  );
  const readingMinutes = news?.readingMinutes || editorialReadingMinutes;

  // 1. 사용자 정보 가져오기
  useEffect(() => {
    const supabase = createClient();
    const syncUser = (next: { id: string } | null) => {
      if (accountId.current !== (next?.id || null)) { setLikesAvailable(false); setIsScraped(false); setIsLiked(false); setReactionError(''); }
      accountId.current = next?.id || null;
      setUser(next);
      setAuthReady(true);
    };
    void supabase.auth.getUser().then(({ data }) => syncUser(data.user || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => syncUser(session?.user || null));
    return () => subscription.unsubscribe();
  }, []);

  // 2. 카테고리 정보 가져오기 (ISR 초기 데이터가 없을 때만 보완)
  useEffect(() => {
    if (post?.category_id && !category) {
      // eslint-disable-next-line react-hooks/immutability
      fetchCategory(post.category_id);
    }
  }, [post?.category_id, category]);

  useEffect(() => {
    if (post?.author_id && !authorProfile) {
      // eslint-disable-next-line react-hooks/immutability
      fetchAuthorProfile(post.author_id);
    }
  }, [post?.author_id, authorProfile]);

  // 3. [중요] 로그인 유저일 경우, 최신 스크랩 상태 동기화 (ISR 보완)
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (post.slug && authReady) {
      // 이미 화면은 보이고 있으므로, 백그라운드에서 조용히 내 상태만 업데이트
      fetch(`/api/posts/by-slug/${post.slug}`, { signal: controller.signal })
        .then((res) => {
           if(res.ok) return res.json();
           throw new Error('Fetch failed');
        })
        .then((data) => {
          if (!active) return;
          setLikesAvailable(data.likes_available);
          // 내 스크랩 상태와 최신 스크랩/조회수 카운트 동기화
          setIsScraped(data.userScraped);
          setScrapCount(data.scrap_count);
          setIsLiked(data.userLiked || false);
          setLikeCount(data.like_count || 0);
          // setViewCount(data.view_count); // 조회수는 아래 recordView에서 처리하므로 생략 가능
        })
        .catch((err) => { if (!controller.signal.aborted) console.error('Background update failed:', err); });
    }
    return () => { active = false; controller.abort(); };
  }, [user?.id, post.slug, authReady]);

  // 4. 조회수 기록
  useEffect(() => {
    if (authReady && post && !hasRecordedView) {
      // eslint-disable-next-line react-hooks/immutability
      recordView();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasRecordedView(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, hasRecordedView, authReady]); // post 객체가 변경되는 것을 방지하기 위해 ID 의존

  useEffect(() => {
    const timer = setTimeout(() => {
      const elements = Array.from(document.querySelectorAll('.tiptap-content h2, .tiptap-content h3'));
      elements.forEach((element, index) => {
        const heading = headings[index];
        if (heading) element.setAttribute('id', heading.id);
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [headings]);

  // --- Functions ---

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
    const requestedAccount = user.id;

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
      if (accountId.current !== requestedAccount) return;
      setIsScraped(data.scraped);
      setScrapCount(data.scrapCount);
    } catch (error) {
      console.error('Failed to toggle scrap:', error);
      alert('오류가 발생했습니다');
    } finally {
      setIsScrapping(false);
    }
  };

  const handleLike = async () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (isLiking) return;
    const requestedAccount = user.id;
    const previous = { liked: isLiked, count: likeCount };
    setIsLiking(true);
    setReactionError('');
    setIsLiked(!previous.liked);
    setLikeCount(Math.max(0, previous.count + (previous.liked ? -1 : 1)));
    try {
      const response = await fetch(`/api/posts/${post.id}/like`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ liked: !previous.liked }) });
      const data = await response.json();
      if (accountId.current !== requestedAccount) return;
      if (!response.ok) throw new Error(data.error || '좋아요를 저장하지 못했습니다.');
      setIsLiked(data.liked);
      setLikeCount(data.like_count);
    } catch (error) {
      if (accountId.current !== requestedAccount) return;
      setIsLiked(previous.liked);
      setLikeCount(previous.count);
      setReactionError(error instanceof Error ? error.message : '좋아요를 저장하지 못했습니다.');
    } finally { setIsLiking(false); }
  };

  const handleCopyLink = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(window.location.href);
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
  const categoryName = news?.categoryName || category?.name || '에디토리얼';
  const authorName = authorProfile?.nickname || authorProfile?.name || 'ARCH.B';
  const authorAvatar = authorProfile?.avatar_url;
  const authorInitial = authorName.charAt(0).toUpperCase();

  return (
    <div className="archive-article news-detail-page min-h-screen bg-[var(--archive-canvas)] text-[var(--archive-ink)]">
      <article>
        <header className="news-detail-header">
          <div className="mx-auto max-w-[var(--archive-page)] px-6 pt-12">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-[var(--archive-muted)]">
              <NextLink href={news?.categoryUrl || '/news/stories?category=editorial'} className="font-semibold transition-colors hover:text-[var(--archive-brand)]">
                {news?.categoryName || '에디토리얼'}
              </NextLink>
              {!news && post.category_id && (
                <>
                  <span className="text-[var(--archive-faint)]">/</span>
                  <NextLink
                    href={`/news/stories?category=editorial&collection=${post.category_id}`}
                    className="font-semibold transition-colors hover:text-[var(--archive-brand)]"
                  >
                    {categoryName}
                  </NextLink>
                </>
              )}
            </div>

            <h1 className="text-[31px] font-bold leading-[1.22] tracking-tight md:text-[40px]">
              {post.title}
            </h1>

            <div className="mt-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--archive-line)] text-[15px] font-bold">
                  {authorAvatar ? (
                    <Image
                      src={authorAvatar}
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
                    {news && `${news.source} 기반 · `}{publishedLabel} · {readingMinutes}분 분량
                  </p>
                </div>
              </div>

              <div className="news-article-actions flex flex-wrap items-center gap-4 text-[12px] text-[var(--archive-muted)]">
                <span className="flex items-center gap-1.5" title="조회수">
                  <i className="ri-eye-line text-[15px]" />
                  <span className="archive-index">{viewCount}</span>
                </span>
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
                <button
                  type="button"
                  onClick={handleScrapToggle}
                  disabled={isScrapping}
                  className="flex items-center gap-1.5 transition-colors hover:text-[var(--archive-brand)] disabled:opacity-50"
                  aria-label="북마크"
                  aria-pressed={isScraped}
                  title="북마크"
                >
                  <i className={`ri-bookmark-${isScraped ? 'fill' : 'line'} text-[14px]`} />
                  <span className="archive-index">{scrapCount}</span>
                </button>
                <button type="button" onClick={handleLike} disabled={isLiking || !likesAvailable} aria-label="좋아요" aria-pressed={isLiked} className="flex items-center gap-1.5 transition-colors hover:text-[var(--archive-brand)] disabled:opacity-50">
                  <i className={`ri-heart-${isLiked ? 'fill' : 'line'} text-[15px]`} aria-hidden="true" />
                  <span className="archive-index">{likeCount}</span>
                </button>
              </div>
            </div>
            {reactionError && <p role="alert" className="mt-3 text-sm text-red-700">{reactionError}</p>}
            <hr className="news-detail-divider" />
          </div>
        </header>

        <div className="mx-auto max-w-[var(--archive-page)] px-6">
          <div className="news-article-layout grid grid-cols-1 gap-10 pb-20 pt-10 lg:grid-cols-[1fr_320px] lg:gap-12 lg:pt-14">
            <main className="min-w-0">
          {(news?.description || summaryItems.length > 0) && (
            <section className="archive-article-summary py-4">
              <div className="mb-4 flex items-center gap-2">
                <i className="ri-flashlight-line text-[17px] text-[var(--archive-brand)]" />
                <p className="archive-eyebrow text-[var(--archive-faint)]">한눈에 보는 핵심요약</p>
              </div>
              {news?.description && <p className="news-summary-deck">{news.description}</p>}
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

          {post.title_image_url && (
            <figure className="news-detail-thumbnail">
              <ArchiveImage src={post.title_image_url} width={1200} height={800} sizes="(max-width: 1024px) 100vw, 820px" alt={post.title} referrerPolicy="no-referrer" />
              {news && <figcaption className="news-detail-image-credit">이미지 제공: {news.source} · 원출처 기사</figcaption>}
            </figure>
          )}

              <div className="article-editor archive-article-body">
                <div className="tiptap-content">
                  {children}
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

              {initialRelatedPosts.length > 0 && (
                <section className="mt-16 border-y border-[var(--archive-line)] py-8">
                  <div className="mb-6 flex items-end justify-between gap-4">
                    <div>
                      <p className="archive-eyebrow mb-2 text-[var(--archive-faint)]">Related</p>
                      <h2 className="text-[22px] font-extrabold tracking-tight">함께 읽기 좋은 글</h2>
                    </div>
                    <NextLink
                      href={news?.categoryUrl || (post.category_id ? `/news/stories?category=editorial&collection=${post.category_id}` : "/news/stories?category=editorial")}
                      className="hidden text-[12px] font-semibold text-[var(--archive-muted)] transition-colors hover:text-[var(--archive-brand)] sm:inline-flex"
                    >
                      더 보기
                    </NextLink>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    {initialRelatedPosts.map((related) => (
                      <NextLink
                        key={related.id}
                        href={`/news/read/${related.slug}`}
                        className="group block min-w-0"
                      >
                        <div className="relative mb-4 aspect-[4/3] overflow-hidden bg-[var(--archive-bg-light)]">
                          {related.title_image_url ? (
                            <ArchiveImage
                              src={related.title_image_url}
                              alt={related.title}
                              fill
                              sizes="(max-width: 768px) 100vw, 33vw"
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--archive-faint)]">
                              ARCH.B
                            </div>
                          )}
                        </div>
                        <p className="archive-eyebrow mb-2 text-[var(--archive-brand)]">
                          {related.type === "news" && related.content?.category ? CATEGORIES[related.content.category] : "에디토리얼"}
                        </p>
                        <h3 className="line-clamp-2 text-[16px] font-bold leading-6 transition-colors group-hover:text-[var(--archive-brand)]">
                          {related.title}
                        </h3>
                        <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[var(--archive-muted)]">
                          {related.summary || related.subtitle || SITE_COPY.blog.relatedFallback}
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
                  onClick={() => router.push(news?.categoryUrl || '/news/stories?category=editorial')}
                  className="inline-flex items-center gap-2 border border-[var(--archive-line)] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] transition-colors hover:border-[var(--archive-brand)] hover:bg-[var(--archive-brand)] hover:text-white"
                >
                  <i className="ri-arrow-left-line text-[15px]" />
                  목록으로
                </button>
              </div>
            </main>

            <aside className="news-detail-sidebar">
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
                      aria-pressed={isScraped}
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
                      {authorAvatar ? (
                        <Image
                          src={authorAvatar}
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
                        {SITE_COPY.brand.authorBio}
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
