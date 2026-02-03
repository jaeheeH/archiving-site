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
function GallerySkeleton({ viewMode }: { viewMode: 'masonry' | 'grid' | 'list' }) {
  const items = Array.from({ length: 12 });
  const layoutClass = {
    masonry: 'columns-2 sm:columns-2 md:columns-4 lg:columns-5 xl:columns-6 gap-2 space-y-2',
    grid: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2',
    list: 'gap-2 grid grid-cols-2',
  }[viewMode];
  const masonryHeights = [240, 320, 210, 380, 290, 230, 350, 270, 310, 250, 340, 280];

  return (
    <div className={layoutClass}>
      {items.map((_, i) => {
        const deterministicHeight = viewMode === 'masonry' 
          ? masonryHeights[i % masonryHeights.length] 
          : null;
        return (
          <div 
            key={i} 
            className={`relative bg-gray-200 animate-pulse rounded-lg border border-gray-100 break-inside-avoid ${viewMode === 'list' ? 'h-48' : ''}`} 
            style={viewMode === 'masonry' ? { height: `${deterministicHeight}px` } : { aspectRatio: '1/1' }}
          ></div>
        );
      })}
    </div>
  );
}

// --- Helper: 페이지네이션 범위 계산 ---
function getPaginationRange(currentPage: number, totalPages: number) {
  const delta = 2;
  const range = [];
  const rangeWithDots = [];

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
      range.push(i);
    }
  }

  let l;
  for (let i of range) {
    if (l) {
      if (i - l === 2) rangeWithDots.push(l + 1);
      else if (i - l !== 1) rangeWithDots.push('...');
    }
    rangeWithDots.push(i);
    l = i;
  }
  return rangeWithDots;
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
  
  const [viewMode, setViewMode] = useState<'masonry' | 'grid' | 'list'>('masonry');
  const [topTags, setTopTags] = useState<TopTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);

  // 디바운스 검색어 초기값도 URL 기준
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('search') || '');
  
  const isFirstRender = useRef(true);
  const isHydrated = useRef(false);

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
    if (p !== page) setPage(p);
    if (s !== searchInput) {
      setSearchInput(s);
      setDebouncedSearch(s);
    }
    if (t !== selectedTags.join(',')) setSelectedTags(tArr);
    
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
    fetchGallery(page, debouncedSearch, selectedTags);

  }, [page, debouncedSearch, selectedTags]);

  const fetchGallery = async (pageNum: number, search: string, tags: string[]) => {
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
  };

  // ... (태그 초기화, 뷰모드 등 기존 로직 동일)
  useEffect(() => {
    fetchTopTags();
    const saved = localStorage.getItem('gallery_view_mode');
    if (saved === 'masonry' || saved === 'grid' || saved === 'list') setViewMode(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('gallery_view_mode', viewMode);
  }, [viewMode]);

  const fetchTopTags = async () => {
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
  };

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

  const layoutClass = {
    masonry: 'columns-2 sm:columns-2 md:columns-4 lg:columns-5 xl:columns-5 gap-2 space-y-2',
    grid: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2',
    list: 'gap-2 grid grid-cols-2',
  }[viewMode];

  const renderGalleryContent = () => {
    if (loading || (fetching && gallery.length === 0)) {
      return <GallerySkeleton viewMode={viewMode} />;
    }

    if (gallery.length === 0) {
      return (
        <div className="w-full text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center">
          <i className="ri-search-2-line text-4xl text-gray-300 mb-3"></i>
          <p className="text-lg text-gray-900 font-medium">No results found.</p>
          <button 
            onClick={() => { setSearchInput(''); setPage(1); setSelectedTags([]); }}
            className="mt-6 px-5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm"
          >
            Clear Search & Filters
          </button>
        </div>
      );
    }

    return (
      <div className={layoutClass}>
        {gallery.map((item) => (
          <GalleryItemImage
            key={item.id}
            item={item}
            viewMode={viewMode}
            onClick={() => handleItemClick(item.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen py-16">
      <div className="max-w-7xl mx-auto mb-8 px-4 md:px-0 title-header">
        <h1 className="">
          Generative Archive
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl leading-relaxed">
          텍스트로 그려낸 상상의 단면들을 기록합니다.<br />
          인공지능이 생성한 독창적인 비주얼과 실험적인 텍스처를 탐험하세요.
        </p>
      </div>

      <div className="max-w-7xl mx-auto pb-16 px-4 md:px-0">
        {/* 컨트롤 패널 */}
        <div className="mb-6 space-y-4 bg-white/80 backdrop-blur-md p-4 rounded-xl border border-gray-100 shadow-sm transition-all duration-200">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            {/* 검색창 */}
            <div className="flex-1 relative group">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search inspiration..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border-transparent hover:bg-gray-100 focus:bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition-all"
              />
              {searchInput && (
                <button
                  onClick={() => { setSearchInput(''); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <i className="ri-close-circle-fill text-lg"></i>
                </button>
              )}
            </div>

            {/* 뷰 모드 토글 */}
            <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
              {(['masonry', 'grid', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-all flex items-center justify-center ${
                    viewMode === mode
                      ? 'bg-white text-black shadow-sm font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <i className={`text-lg ${
                    mode === 'masonry' ? 'ri-layout-masonry-line' :
                    mode === 'grid' ? 'ri-layout-grid-line' : 'ri-list-check'
                  }`}></i>
                </button>
              ))}
            </div>
          </div>

          {/* 상단 태그 필터 */}
          {!loadingTags && topTags.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-100">
              {topTags.map((item) => (
                <button
                  key={item.tag}
                  onClick={() => handleTagToggle(item.tag)}
                  className={`px-3 py-1 text-xs rounded-full border transition-all ${
                    selectedTags.includes(item.tag)
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  #{item.tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 활성 필터 UI */}
        <div className="mb-2">
          <ActiveFilter />
        </div>

        {renderGalleryContent()}

        {/* 페이지네이션 */}
        {!loading && gallery.length > 0 && totalPages > 1 && (
          <div className={`flex flex-wrap justify-center items-center mt-12 gap-2 transition-opacity duration-200 ${fetching ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <button
              onClick={() => updatePage(1)}
              disabled={page === 1}
              className="w-10 h-10 flex items-center justify-center border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-colors"
              title="First Page"
            >
              <i className="ri-skip-back-line"></i>
            </button>
            <button
              onClick={() => updatePage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="w-10 h-10 flex items-center justify-center border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-colors"
              title="Previous Page"
            >
              <i className="ri-arrow-left-s-line text-lg"></i>
            </button>
            <div className="flex items-center gap-1 mx-2">
              <div className="hidden md:flex gap-1">
                {getPaginationRange(page, totalPages).map((p, idx) => (
                   p === '...' ? (
                     <span key={`dots-${idx}`} className="w-8 text-center text-gray-400 font-mono">...</span>
                   ) : (
                     <button
                       key={p}
                       onClick={() => updatePage(Number(p))}
                       className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-mono transition-all ${
                         page === p
                           ? 'bg-black text-white font-bold'
                           : 'bg-white border hover:bg-gray-50 text-gray-600'
                       }`}
                     >
                       {p}
                     </button>
                   )
                ))}
              </div>
              <span className="md:hidden px-2 text-gray-500 font-mono text-sm whitespace-nowrap">
                 {page} / {totalPages}
              </span>
            </div>
            <button
              onClick={() => updatePage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="w-10 h-10 flex items-center justify-center border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-colors"
              title="Next Page"
            >
              <i className="ri-arrow-right-s-line text-lg"></i>
            </button>
            <button
              onClick={() => updatePage(totalPages)}
              disabled={page === totalPages}
              className="w-10 h-10 flex items-center justify-center border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-colors"
              title="Last Page"
            >
              <i className="ri-skip-forward-line"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Image Item Component (기존 동일) ---
function GalleryItemImage({ item, viewMode, onClick }: { item: GalleryItem; viewMode: 'masonry' | 'grid' | 'list'; onClick: () => void; }) {
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

  if (viewMode === 'masonry') {
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
  
  if (viewMode === 'grid') {
      return (
        <div className={containerClass} onClick={onClick}>
          <div className="relative w-full aspect-square">
            <Image
              src={item.image_url}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
              className="object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
              placeholder="blur"
              blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiIC8+PC9zdmc+"
            />
            {HoverOverlay}
          </div>
        </div>
      );
    }
  
    // List View
    return (
      <div className={containerClass} onClick={onClick}>
        <div className="relative w-full h-48">
          <Image
            src={item.image_url}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            placeholder="blur"
            blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiIC8+PC9zdmc+"
          />
          {HoverOverlay}
        </div>
      </div>
    );
}