'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ToastProvider';
import { formatKoreanDate, getSeoulDateKey } from '@/lib/date-format';

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

interface DailyImage {
  id: number;
  title: string;
  description: string | null;
  image_url: string;
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
  dailyImages: DailyImage[];
}

export default function BlogClient({
  initialPosts,
  categories,
  initialPagination,
  dailyImages,
}: BlogClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { addToast } = useToast();

  // URL에서 초기값 읽기
  const initialPage = Number(searchParams.get('page')) || 1;
  const initialCategory = searchParams.get('category') || 'all';

  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [fetching, setFetching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pagination, setPagination] = useState<PaginationInfo>(initialPagination);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [scrapedPostIds, setScrapedPostIds] = useState<Set<string>>(new Set());
  const [scrappingPostIds, setScrappingPostIds] = useState<Set<string>>(new Set());

  const POSTS_PER_PAGE = 12;

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

  // 3️⃣ URL 파라미터가 초기값(1페이지, all)이 아니면 데이터 fetch
  useEffect(() => {
    if (initialPage !== 1 || initialCategory !== 'all') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchPosts(initialPage, initialCategory);
    }
  }, []); // 마운트 시 1회만 실행

  useEffect(() => {
    let cancelled = false;

    const syncScrapStatus = async () => {
      const postIds = posts.map((post) => post.id);

      if (postIds.length === 0) {
        setScrapedPostIds(new Set());
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;

      if (cancelled) return;
      setCurrentUserId(userId);

      if (!userId) {
        setScrapedPostIds(new Set());
        return;
      }

      const { data, error } = await supabase
        .from('post_scraps')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds);

      if (cancelled) return;

      if (error) {
        console.error('Failed to fetch blog scraps:', error);
        return;
      }

      setScrapedPostIds(
        new Set((data || []).map((scrap: { post_id: string }) => scrap.post_id))
      );
    };

    syncScrapStatus();

    return () => {
      cancelled = true;
    };
  }, [posts, supabase]);

  // 4️⃣ 브라우저 뒤로가기/앞으로가기 감지 (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const page = Number(params.get('page')) || 1;
      const category = params.get('category') || 'all';
      
      setCurrentPage(page);
      setSelectedCategory(category);
      fetchPosts(page, category);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // URL 업데이트 함수
  const updateURL = (page: number, category: string) => {
    const params = new URLSearchParams();
    if (page !== 1) params.set('page', String(page));
    if (category !== 'all') params.set('category', category);
    
    const queryString = params.toString();
    const newURL = queryString ? `/blog?${queryString}` : '/blog';
    
    router.push(newURL, { scroll: false });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateURL(page, selectedCategory);
    fetchPosts(page, selectedCategory);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
    updateURL(1, categoryId);
    fetchPosts(1, categoryId);
  };

  const handleScrapToggle = async (event: React.MouseEvent<HTMLButtonElement>, post: Post) => {
    event.preventDefault();
    event.stopPropagation();

    if (scrappingPostIds.has(post.id)) return;

    let userId = currentUserId;
    if (!userId) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      userId = session?.user?.id ?? null;
      setCurrentUserId(userId);
    }

    if (!userId) {
      addToast('로그인이 필요합니다', 'error');
      const redirectTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      router.push(`/login?redirect=${redirectTo}`);
      return;
    }

    setScrappingPostIds((prev) => {
      const next = new Set(prev);
      next.add(post.id);
      return next;
    });

    try {
      const res = await fetch(`/api/posts/${post.id}/scrap`, { method: 'POST' });

      if (res.status === 401) {
        addToast('로그인이 필요합니다', 'error');
        const redirectTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
        router.push(`/login?redirect=${redirectTo}`);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || '북마크 처리에 실패했습니다', 'error');
        return;
      }

      setScrapedPostIds((prev) => {
        const next = new Set(prev);
        if (data.scraped) next.add(post.id);
        else next.delete(post.id);
        return next;
      });
      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id ? { ...item, scrap_count: data.scrapCount } : item
        )
      );
      addToast(data.scraped ? '북마크에 저장되었습니다' : '북마크가 해제되었습니다', 'success');
    } catch (error) {
      console.error('Failed to toggle blog scrap:', error);
      addToast('북마크 처리 중 오류가 발생했습니다', 'error');
    } finally {
      setScrappingPostIds((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  };

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find((cat) => cat.id === categoryId);
    return category?.name || 'Uncategorized';
  };

  const formatDate = (date: string | null) => formatKoreanDate(date, 'long');

  const selectedCategoryName =
    selectedCategory === 'all' ? 'All' : getCategoryName(selectedCategory);

  const sidebarPosts = useMemo(() => posts.slice(0, 4), [posts]);
  const todayImages = useMemo(() => {
    if (dailyImages.length === 0) return [];

    const todayKey = getSeoulDateKey();
    const seed = todayKey
      .split('-')
      .reduce((total, part, index) => total + Number(part) * (index + 1), 0);
    const targetCount = Math.min(3, dailyImages.length);
    const selected: DailyImage[] = [];
    const usedIndexes = new Set<number>();

    for (let step = 0; selected.length < targetCount && step < dailyImages.length * 2; step += 1) {
      const index = (seed + step * 7) % dailyImages.length;
      if (usedIndexes.has(index)) continue;
      usedIndexes.add(index);
      selected.push(dailyImages[index]);
    }

    return selected;
  }, [dailyImages]);
  const totalPages = Math.ceil(pagination.total / POSTS_PER_PAGE);

  return (
    <div className="archive-blog min-h-screen bg-[var(--archive-canvas)] text-[var(--archive-ink)]">
      <section className="border-b border-[var(--archive-line)]">
        <div className="mx-auto max-w-[var(--archive-page)] px-4 pb-8 pt-14">
          <p className="archive-eyebrow mb-3 text-[var(--archive-faint)]">Magazine</p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Blog</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--archive-muted)]">
            개발 과정의 고민과 디자인적 발견을 기록합니다. 프로젝트 비하인드 스토리와 기술적인 인사이트를 공유합니다.
          </p>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-b border-[var(--archive-line)] bg-[var(--archive-canvas)]/95 backdrop-blur">
        <div className="mx-auto max-w-[var(--archive-page)] px-4">
          <nav className="flex gap-6 overflow-x-auto py-4">
            <button
              onClick={() => handleCategoryChange('all')}
              className={`whitespace-nowrap border-b-2 pb-1 text-[13px] font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'border-[var(--archive-ink)] text-[var(--archive-ink)]'
                  : 'border-transparent text-[var(--archive-muted)] hover:text-[var(--archive-brand)]'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id)}
                className={`whitespace-nowrap border-b-2 pb-1 text-[13px] font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'border-[var(--archive-ink)] text-[var(--archive-ink)]'
                    : 'border-transparent text-[var(--archive-muted)] hover:text-[var(--archive-brand)]'
                }`}
              >
                {category.name}
              </button>
            ))}
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-[var(--archive-page)] px-4 py-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px] lg:gap-12">
          <div className="min-w-0">
            <div className="mb-4 flex items-center justify-between text-[12px] text-[var(--archive-muted)]">
              <span className="archive-eyebrow text-[var(--archive-faint)]">{selectedCategoryName}</span>
              <span className="archive-index">{pagination.total} Posts</span>
            </div>

            {fetching && posts.length === 0 ? (
              <div className="border-y border-[var(--archive-line)] py-10 text-[14px] text-[var(--archive-muted)]">
                Loading...
              </div>
            ) : posts.length === 0 ? (
              <div className="border-y border-[var(--archive-line)] py-20 text-center text-[14px] text-[var(--archive-muted)]">
                작성된 글이 없습니다.
              </div>
            ) : (
              <div className={`border-t border-[var(--archive-line)] ${fetching ? 'opacity-60' : ''}`}>
                {posts.map((post) => (
                  <article key={post.id} className="border-b border-[var(--archive-line)] py-7">
                    <div className="grid grid-cols-[1fr_120px] gap-5 sm:grid-cols-[1fr_180px] md:grid-cols-[1fr_220px] md:gap-8">
                      <div className="flex min-w-0 flex-col">
                        <Link href={`/blog/${post.slug}`} className="group block">
                          <div className="mb-3 flex items-center gap-2 text-[12px] text-[var(--archive-muted)]">
                            <span className="text-[var(--archive-ink)] font-medium">ARCH.B</span>
                            <span className="text-[var(--archive-faint)]">·</span>
                            <span>{formatDate(post.published_at || post.created_at)}</span>
                          </div>
                          <h2 className="mb-2 line-clamp-2 text-xl font-extrabold leading-[1.25] tracking-tight transition-colors group-hover:text-[var(--archive-brand)] md:text-2xl">
                            {post.title}
                          </h2>
                          <p className="line-clamp-2 text-[14px] leading-[1.65] text-[var(--archive-muted)] md:text-[15px]">
                            {post.summary || post.subtitle || '내용이 없습니다.'}
                          </p>
                        </Link>
                        <div className="mt-5 flex items-center justify-between text-[12px] text-[var(--archive-muted)]">
                          <div className="flex items-center gap-4">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--archive-brand)]">
                              {getCategoryName(post.category_id)}
                            </span>
                            <span className="flex items-center gap-1.5" title="조회수">
                              <i className="ri-eye-line text-[14px]" />
                              <span className="archive-index">{post.view_count || 0}</span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => handleScrapToggle(event, post)}
                            disabled={scrappingPostIds.has(post.id)}
                            aria-pressed={scrapedPostIds.has(post.id)}
                            aria-label={scrapedPostIds.has(post.id) ? '북마크 해제' : '북마크'}
                            title={scrapedPostIds.has(post.id) ? '북마크 해제' : '북마크'}
                            className={`flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                              scrapedPostIds.has(post.id)
                                ? 'text-[var(--archive-brand)]'
                                : 'text-[var(--archive-muted)] hover:text-[var(--archive-brand)]'
                            }`}
                          >
                            <i
                              className={`${
                                scrapedPostIds.has(post.id) ? 'ri-bookmark-fill' : 'ri-bookmark-line'
                              } text-[15px]`}
                            />
                            <span className="archive-index">{post.scrap_count || 0}</span>
                          </button>
                        </div>
                      </div>

                      <Link
                        href={`/blog/${post.slug}`}
                        className="archive-zoom relative aspect-square self-start overflow-hidden bg-[var(--archive-bg-light)]"
                      >
                        {post.title_image_url ? (
                          <Image
                            src={post.title_image_url}
                            alt={post.title}
                            fill
                            className="archive-zoom-image object-cover"
                            sizes="220px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[var(--archive-faint)]">
                            <i className="ri-image-2-line text-2xl" />
                          </div>
                        )}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="hidden lg:block lg:sticky lg:top-36 lg:self-start">
            <div className="flex flex-col gap-5">
              <section className="border border-[var(--archive-line)] bg-[var(--archive-canvas)]">
                <div className="flex items-center gap-1.5 border-b border-[var(--archive-line)] px-4 py-2.5">
                  <i className="ri-newspaper-line text-sm" />
                  <span className="archive-eyebrow">Latest</span>
                </div>
                {sidebarPosts.map((post, index) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className={`block px-4 py-3.5 transition-colors hover:bg-[var(--archive-bg-light)] hover:text-[var(--archive-brand)] ${
                      index !== sidebarPosts.length - 1 ? 'border-b border-[var(--archive-line)]' : ''
                    }`}
                  >
                    <p className="line-clamp-2 text-[14px] font-bold leading-[1.35] transition-colors">
                      {post.title}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--archive-muted)]">
                      {formatDate(post.published_at || post.created_at)}
                    </p>
                  </Link>
                ))}
              </section>

              {todayImages.length > 0 && (
                <section className="border border-[var(--archive-line)] bg-[var(--archive-canvas)]">
                  <div className="flex items-center gap-1.5 border-b border-[var(--archive-line)] px-4 py-2.5">
                    <i className="ri-image-line text-sm" />
                    <span className="archive-eyebrow">오늘의 이미지</span>
                  </div>
                  <div>
                    {todayImages.map((image, index) => (
                      <Link
                        key={image.id}
                        href={`/gallery/${image.id}`}
                        className={`group grid grid-cols-[56px_1fr] gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--archive-bg-light)] ${
                          index !== todayImages.length - 1 ? 'border-b border-[var(--archive-line)]' : ''
                        }`}
                        aria-label={image.title}
                      >
                        <span className="archive-zoom relative h-14 w-14 overflow-hidden bg-[var(--archive-bg-light)]">
                          <Image
                            src={image.image_url}
                            alt={image.title}
                            fill
                            className="archive-zoom-image object-cover"
                            sizes="56px"
                          />
                        </span>
                        <span className="min-w-0 self-center">
                          <span className="line-clamp-2 text-[14px] font-bold leading-[1.35] transition-colors group-hover:text-[var(--archive-brand)]">
                            {image.title}
                          </span>
                          <span className="mt-1 block truncate text-[11px] leading-4 text-[var(--archive-muted)]">
                            {image.description || '프롬프트가 없습니다.'}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </aside>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-16 flex items-center justify-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="border border-[var(--archive-line)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--archive-ink)] transition hover:border-[var(--archive-brand)] hover:bg-[var(--archive-brand)] hover:text-white disabled:text-[var(--archive-muted)] disabled:opacity-40 disabled:hover:border-[var(--archive-line)] disabled:hover:bg-transparent disabled:hover:text-[var(--archive-muted)]"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`h-9 w-9 text-[12px] font-semibold transition ${
                  page === currentPage
                    ? 'bg-[var(--archive-ink)] text-[var(--archive-canvas)]'
                    : 'text-[var(--archive-muted)] hover:bg-[var(--archive-bg-light)] hover:text-[var(--archive-brand)]'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="border border-[var(--archive-line)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--archive-ink)] transition hover:border-[var(--archive-brand)] hover:bg-[var(--archive-brand)] hover:text-white disabled:text-[var(--archive-muted)] disabled:opacity-40 disabled:hover:border-[var(--archive-line)] disabled:hover:bg-transparent disabled:hover:text-[var(--archive-muted)]"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
