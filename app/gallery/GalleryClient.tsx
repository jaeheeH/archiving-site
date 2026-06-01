'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import ActiveFilter from "@/components/gallery/ActiveFilter";

// --- Types ---
export type GalleryItem = {
  id: number;
  title: string;
  description?: string;
  image_url: string;
  image_width: number;
  image_height: number;
  tags: string[];
  gemini_tags: string[];
};

type TopTag = {
  tag: string;
  count: number;
};

// --- Skeleton Component ---
function GallerySkeleton() {
  const items = Array.from({ length: 12 });
  const masonryHeights = [240, 320, 210, 380, 290, 230, 350, 270, 310, 250, 340, 280];

  return (
    <div className="columns-2 gap-2 space-y-2 sm:columns-2 md:columns-4 lg:columns-5 xl:columns-6">
      {items.map((_, i) => {
        const deterministicHeight = masonryHeights[i % masonryHeights.length];
        return (
          <div 
            key={i} 
            className="relative break-inside-avoid rounded-lg border border-gray-100 bg-gray-200 animate-pulse dark:border-[#302d28] dark:bg-[#1d1d1d]"
            style={{ height: `${deterministicHeight}px` }}
          ></div>
        );
      })}
    </div>
  );
}

// --- Props ---
interface GalleryClientProps {
  initialGallery: GalleryItem[];
  initialTotalPages: number;
}

// --- Main Component ---
export default function GalleryClient({ initialGallery, initialTotalPages }: GalleryClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // State
  const [gallery, setGallery] = useState<GalleryItem[]>(initialGallery);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // ✅ [수정 핵심] 초기값을 URL 파라미터에서 바로 읽어옵니다. (1로 고정하지 않음)
  const [page, setPage] = useState(() => Number(searchParams.get('page')) || 1);
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const tags = searchParams.get('tags');
    return tags ? tags.split(',').filter(Boolean) : [];
  });
  const [topTags, setTopTags] = useState<TopTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);

  // 디바운스 검색어 초기값도 URL 기준
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('search') || '');
  
  const isHydrated = useRef(false);

  async function fetchGallery(pageNum: number, search: string, tags: string[]) {
    try {
      setFetching(true);
      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('limit', '36');
      if (search.trim()) params.set('search', search.trim());
      if (tags.length > 0) params.set('tags', tags.join(','));

      const res = await fetch(`/api/gallery?${params.toString()}`);
      if (!res.ok) throw new Error('갤러리 조회 실패');

      const data = await res.json();
      setGallery(data.data || []);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('❌ Fetch 에러:', error);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }

  async function fetchTopTags() {
    try {
      setLoadingTags(true);
      const res = await fetch('/api/gallery/tags/top');
      if (!res.ok) throw new Error('태그 조회 실패');
      const data = await res.json();
      setTopTags(data.tags || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingTags(false);
    }
  }

  // 1. URL 파라미터 변경 감지 (뒤로 가기 시 상태 동기화)
  useEffect(() => {
    // 마운트 직후에는 실행하지 않음 (이미 useState 초기값으로 잡았으므로)
    if (!isHydrated.current) {
      isHydrated.current = true;
      return;
    }

    const p = Number(searchParams.get('page') || 1);
    const s = searchParams.get('search') || '';
    const t = searchParams.get('tags') || '';
    const tArr = t ? t.split(',').filter(Boolean) : [];

    // 현재 상태와 URL이 다를 때만 업데이트 (중복 렌더링 방지)
    /* eslint-disable react-hooks/set-state-in-effect */
    if (p !== page) setPage(p);
    if (s !== searchInput) {
      setSearchInput(s);
      setDebouncedSearch(s);
    }
    if (t !== selectedTags.join(',')) setSelectedTags(tArr);
    /* eslint-enable react-hooks/set-state-in-effect */
    
  }, [searchParams]); // searchParams가 변할 때만 실행 (뒤로가기 등)

  // 2. 검색어 디바운스
  useEffect(() => {
    // 초기 로딩시에는 실행 안 함 (이미 동기화됨)
    if (searchInput === (searchParams.get('search') || '')) return;

    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 3. 검색어 변경 시 페이지 리셋
  useEffect(() => {
    // 실제 검색어가 바뀌었을 때만 페이지 1로 리셋
    const urlSearch = searchParams.get('search') || '';
    if (debouncedSearch !== urlSearch) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(1);
    }
  }, [debouncedSearch]);

  // 4. 데이터 페칭
  useEffect(() => {
    // 첫 렌더링이고, URL 파라미터가 초기값과 같다면(즉, 이미 서버/기본 데이터와 같다면) 스킵
    // 하지만 페이지 이동으로 돌아왔을 때는 데이터를 다시 불러와야 할 수도 있음.
    // 여기서는 안전하게 로직을 수행하되, 중복 호출을 최소화.
    
    // URL 업데이트 로직
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page)); // 1페이지면 생략 깔끔
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (selectedTags.length > 0) params.set('tags', selectedTags.join(','));
    
    const queryString = params.toString();
    const newUrl = `${pathname}${queryString ? `?${queryString}` : ''}`;

    // URL을 교체해야 하는 경우 (사용자 액션으로 인한 상태 변경)
    if (window.location.search !== (queryString ? `?${queryString}` : '')) {
      router.replace(newUrl, { scroll: false });
    }

    // 데이터 요청
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGallery(page, debouncedSearch, selectedTags);

  }, [page, debouncedSearch, selectedTags]);

  // 태그 초기화
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTopTags();
  }, []);

  const handleSearchChange = (value: string) => setSearchInput(value);
  
  const handleTagToggle = (tag: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setPage(1);
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };
  
  const updatePage = (pageNum: number) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setPage(pageNum);
  };

  // ✅ [중요] 상세 페이지 이동 시 현재 쿼리 파라미터 전달
  const handleItemClick = (id: number) => {
    // 현재 URL의 쿼리 스트링 (page=3&tags=abc 등)을 그대로 가져감
    const currentParams = searchParams.toString();
    const queryString = currentParams ? `?${currentParams}` : '';
    
    // 상세 페이지로 이동
    router.push(`/gallery/${id}${queryString}`);
  };

  const renderGalleryContent = () => {
    if (loading || (fetching && gallery.length === 0)) {
      return <GallerySkeleton />;
    }

    if (gallery.length === 0) {
      return (
        <div className="w-full text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center">
          <i className="ri-search-2-line text-4xl text-gray-300 mb-3"></i>
          <p className="text-lg text-gray-900 font-medium">No results found.</p>
          <button 
            onClick={() => { setSearchInput(''); setPage(1); setSelectedTags([]); }}
            className="mt-6 border border-[var(--archive-line)] bg-white px-5 py-2.5 text-sm font-medium transition-colors hover:border-[var(--archive-brand)] hover:text-[var(--archive-brand)]"
          >
            Clear Search & Filters
          </button>
        </div>
      );
    }

    return (
      <div className="columns-2 gap-8 space-y-8 sm:columns-2 md:columns-4 lg:columns-4 xl:columns-4">
        {gallery.map((item) => (
          <GalleryItemImage
            key={item.id}
            item={item}
            onClick={() => handleItemClick(item.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="archive-page-shell min-h-screen">
      <section className="border-b border-[var(--archive-line)]">
        <div className="mx-auto max-w-[var(--archive-page)] px-4 pb-8 pt-14">
          <p className="archive-eyebrow mb-3 text-[var(--archive-faint)]">Visual Archive</p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Gallery</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--archive-muted)]">
            텍스트로 그려낸 상상의 단면들을 기록합니다. 인공지능이 생성한 독창적인 비주얼과 실험적인 텍스처를 탐험하세요.
          </p>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-b border-[var(--archive-line)] bg-[var(--archive-canvas)]/95 backdrop-blur">
        <div className="mx-auto max-w-[var(--archive-page)] px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* 검색창 */}
            <div className="flex-1 relative group">
              <i className="ri-search-line absolute left-0 top-1/2 -translate-y-1/2 text-[var(--archive-muted)]"></i>
              <input
                type="text"
                placeholder="Search inspiration..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full border-0 border-b border-[var(--archive-line)] bg-transparent py-2.5 pl-7 pr-10 text-[13px] outline-none transition-colors placeholder:text-[var(--archive-faint)] hover:border-[var(--archive-brand)] focus:border-[var(--archive-brand)]"
              />
              {searchInput && (
                <button
                  onClick={() => { setSearchInput(''); setPage(1); }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-[var(--archive-muted)] transition-colors hover:text-[var(--archive-brand)]"
                >
                  <i className="ri-close-circle-fill text-lg"></i>
                </button>
              )}
            </div>

          </div>

          {/* 상단 태그 필터 */}
          {!loadingTags && topTags.length > 0 && (
            <nav className="flex gap-6 overflow-x-auto pt-2">
              {topTags.map((item) => (
                <button
                  key={item.tag}
                  onClick={() => handleTagToggle(item.tag)}
                  className={`whitespace-nowrap border-b-2 pb-1 text-[13px] font-medium transition-colors ${
                    selectedTags.includes(item.tag)
                      ? 'border-[var(--archive-ink)] text-[var(--archive-ink)]'
                      : 'border-transparent text-[var(--archive-muted)] hover:text-[var(--archive-brand)]'
                  }`}
                >
                  #{item.tag}
                </button>
              ))}
            </nav>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[var(--archive-page)] px-4 py-10 pb-16">
        <div className="mb-4 flex items-center justify-between text-[12px] text-[var(--archive-muted)]">
          <span className="archive-eyebrow text-[var(--archive-faint)]">
            {selectedTags.length > 0 ? selectedTags.join(', ') : 'All'}
          </span>
          <span className="archive-index">{gallery.length} Items</span>
        </div>
        {/* 활성 필터 UI */}
        <div className="mb-2">
          <ActiveFilter />
        </div>

        {renderGalleryContent()}

        {/* 페이지네이션 */}
        {!loading && gallery.length > 0 && totalPages > 1 && (
          <div className={`mt-16 flex flex-wrap items-center justify-center gap-2 transition-opacity duration-200 ${fetching ? 'pointer-events-none opacity-50' : 'opacity-100'}`}>
            <button
              onClick={() => updatePage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="border border-[var(--archive-line)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--archive-ink)] transition hover:border-[var(--archive-brand)] hover:bg-[var(--archive-brand)] hover:text-white disabled:text-[var(--archive-muted)] disabled:opacity-40 disabled:hover:border-[var(--archive-line)] disabled:hover:bg-transparent disabled:hover:text-[var(--archive-muted)]"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => updatePage(pageNumber)}
                className={`h-9 w-9 text-[12px] font-semibold transition ${
                  pageNumber === page
                    ? 'bg-[var(--archive-ink)] text-[var(--archive-canvas)]'
                    : 'text-[var(--archive-muted)] hover:bg-[var(--archive-bg-light)] hover:text-[var(--archive-brand)]'
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              onClick={() => updatePage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
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

// --- Image Item Component ---
function GalleryItemImage({ item, onClick }: { item: GalleryItem; onClick: () => void; }) {
  const HoverOverlay = (
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
      <h3 className="text-white font-medium text-sm line-clamp-1 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
        {item.title}
      </h3>
      {item.tags && item.tags.length > 0 && (
        <p className="text-gray-300 text-xs mt-1 translate-y-2 group-hover:translate-y-0 transition-transform duration-300 delay-75">
          #{item.tags[0]} {item.tags.length > 1 && `+${item.tags.length - 1}`}
        </p>
      )}
    </div>
  );

  const containerClass = "group relative  overflow-hidden  cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300";

  return (
    <div className={`${containerClass} break-inside-avoid`} onClick={onClick}>
      <div className="relative w-full" style={{ aspectRatio: `${item.image_width} / ${item.image_height}` }}>
        <Image
          src={item.image_url}
          alt={item.title}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          quality={75}
          className="object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
          placeholder="blur"
          blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiIC8+PC9zdmc+"
        />
        {HoverOverlay}
      </div>
    </div>
  );
}
