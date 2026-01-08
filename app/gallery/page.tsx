'use client';

import { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
// 경로가 다르다면 실제 경로로 수정해주세요
import ClientGalleryDetailModal from '@/components/gallery/ClientGalleryDetailModal';

// --- Types ---
type GalleryItem = {
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

// --- Skeleton Component (하이드레이션 에러 방지 적용) ---
function GallerySkeleton({ viewMode }: { viewMode: 'masonry' | 'grid' | 'list' }) {
  const items = Array.from({ length: 12 });

  const layoutClass = {
    masonry: 'columns-2 sm:columns-2 md:columns-4 lg:columns-5 xl:columns-6 gap-2 space-y-2',
    grid: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2',
    list: 'gap-2 grid grid-cols-2',
  }[viewMode];

  // 서버/클라이언트 불일치 방지를 위한 고정 높이 패턴
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
            className={`relative bg-gray-200 animate-pulse rounded-lg overflow-hidden border border-gray-100 break-inside-avoid ${
              viewMode === 'list' ? 'h-48' : ''
            }`}
            style={viewMode === 'masonry' ? { height: `${deterministicHeight}px` } : { aspectRatio: '1/1' }}
          >
            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-3 bg-gray-300 rounded w-1/2"></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Main Content Component ---
function GalleryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // URL 파라미터
  const pageFromUrl = Number(searchParams.get('page') || 1);
  const searchFromUrl = searchParams.get('search') || '';
  const tagsFromUrl = searchParams.get('tags') || '';

  // 상태 관리
  const [viewMode, setViewMode] = useState<'masonry' | 'grid' | 'list'>('masonry');
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true); // 초기 로딩
  const [fetching, setFetching] = useState(false); // 필터/페이지 이동 로딩
  const [page, setPage] = useState(pageFromUrl);
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    tagsFromUrl ? tagsFromUrl.split(',') : []
  );
  const [topTags, setTopTags] = useState<TopTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);

  const limit = 36;
  const [totalPages, setTotalPages] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // 검색 디바운싱
  const [debouncedSearch, setDebouncedSearch] = useState(searchFromUrl);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 검색어 변경 시 페이지 리셋
  useEffect(() => {
    if (debouncedSearch !== searchFromUrl) setPage(1);
  }, [debouncedSearch]);

  // URL 업데이트
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (selectedTags.length > 0) params.set('tags', selectedTags.join(','));

    const newUrl = `${pathname}?${params.toString()}`;
    if (window.location.search !== `?${params.toString()}`) {
      router.replace(newUrl);
    }
  }, [page, debouncedSearch, selectedTags, pathname, router]);

  // 갤러리 데이터 조회
  const fetchGallery = async (pageNum: number, search: string, tags: string[]) => {
    try {
      setFetching(true);
      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('limit', String(limit));
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

  // 태그 조회
  const fetchTopTags = async () => {
    try {
      setLoadingTags(true);
      const res = await fetch('/api/gallery/tags/top');
      if (!res.ok) throw new Error('태그 조회 실패');
      const data = await res.json();
      setTopTags(data.tags || []);
    } catch (error) {
      console.error('❌ 태그 조회 에러:', error);
    } finally {
      setLoadingTags(false);
    }
  };

  const handleSearchChange = (value: string) => setSearchInput(value);
  
  const handleTagToggle = (tag: string) => {
    setPage(1);
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };
  
  const updatePage = (pageNum: number) => setPage(pageNum);

  // 이펙트
  useEffect(() => {
    fetchGallery(page, debouncedSearch, selectedTags);
  }, [page, debouncedSearch, selectedTags]);

  useEffect(() => {
    fetchTopTags();
    const saved = localStorage.getItem('gallery_view_mode');
    if (saved === 'masonry' || saved === 'grid' || saved === 'list') setViewMode(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('gallery_view_mode', viewMode);
  }, [viewMode]);

  const layoutClass = {
    masonry: 'columns-2 sm:columns-2 md:columns-4 lg:columns-5 xl:columns-5 gap-2 space-y-2',
    grid: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2',
    list: 'gap-2 grid grid-cols-2',
  }[viewMode];

  // --- 렌더링 로직 분리 (문제 해결 핵심) ---
  const renderGalleryContent = () => {
    // 1. 로딩 중
    if (loading || (fetching && gallery.length === 0)) {
      return <GallerySkeleton viewMode={viewMode} />;
    }

    // 2. 검색 결과 없음 (여기서 레이아웃 클래스를 쓰지 않고 풀 위드로 렌더링)
    if (gallery.length === 0) {
      return (
        <div className="w-full text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center">
          <i className="ri-search-2-line text-4xl text-gray-300 mb-3"></i>
          <p className="text-lg text-gray-900 font-medium">No results found.</p>
          <p className="text-sm text-gray-500 mt-2 max-w-md">
            Try adjusting your search or filters to find what you're looking for.
          </p>
          {(searchInput || selectedTags.length > 0) && (
            <button 
              onClick={() => { setSearchInput(''); setPage(1); setSelectedTags([]); }}
              className="mt-6 px-5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
            >
              Clear Search & Filters
            </button>
          )}
        </div>
      );
    }

    // 3. 데이터 있음 (레이아웃 클래스 적용)
    return (
      <div className={layoutClass}>
        {gallery.map((item) => (
          <GalleryItemImage
            key={item.id}
            item={item}
            viewMode={viewMode}
            onClick={() => setSelectedId(item.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen contents mx-auto py-12">
      {/* 헤더 섹션 */}
      <div className="max-w-7xl mx-auto mb-10 px-4 md:px-0">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4 font-sans uppercase">
          Generative Archive
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl leading-relaxed">
          텍스트로 그려낸 상상의 단면들을 기록합니다.<br />
          인공지능이 생성한 독창적인 비주얼과 실험적인 텍스처를 탐험하세요.
        </p>
      </div>

      <div className="px-4 md:px-0">
        {/* 컨트롤 패널 */}
        <div className="mb-6 space-y-4 sticky top-4 z-30 bg-white/80 backdrop-blur-md p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            {/* 검색창 */}
            <div className="flex-1 relative group">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors"></i>
              <input
                type="text"
                placeholder="Search inspiration..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border-transparent hover:bg-gray-100 focus:bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
              />
              {searchInput && (
                <button
                  onClick={() => { setSearchInput(''); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                  className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                    viewMode === mode
                      ? 'bg-white text-black shadow-sm font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  aria-label={`${mode} view`}
                >
                  <i className={
                    mode === 'masonry' ? 'ri-layout-masonry-line' :
                    mode === 'grid' ? 'ri-layout-grid-line' : 'ri-list-check'
                  }></i>
                </button>
              ))}
            </div>
          </div>

          {/* 태그 필터 */}
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
              {selectedTags.length > 0 && (
                <button
                  onClick={() => { setPage(1); setSelectedTags([]); }}
                  className="px-2 py-1 text-xs text-red-500 hover:text-red-700 font-medium ml-auto"
                >
                  Reset Filter
                </button>
              )}
            </div>
          )}
        </div>

        {/* 갤러리 콘텐츠 (렌더링 함수 호출) */}
        {renderGalleryContent()}

        {/* 페이지네이션 (데이터가 있을 때만 표시) */}
        {!loading && gallery.length > 0 && totalPages > 1 && (
          <div className={`flex justify-center mt-12 gap-2 transition-opacity ${fetching ? 'opacity-50 pointer-events-none' : ''}`}>
            <button
              onClick={() => updatePage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border rounded-lg disabled:opacity-30 bg-white hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-500 font-mono text-sm flex items-center">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => updatePage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border rounded-lg disabled:opacity-30 bg-white hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {selectedId !== null && (
        <ClientGalleryDetailModal
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onChangeId={setSelectedId}
        />
      )}
    </div>
  );
}

// --- Image Item Component ---
function GalleryItemImage({
  item,
  viewMode,
  onClick,
}: {
  item: GalleryItem;
  viewMode: 'masonry' | 'grid' | 'list';
  onClick: () => void;
}) {
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

  if (viewMode === 'masonry') {
    return (
      <div
        className="group relative border border-gray-100 rounded-lg overflow-hidden bg-gray-100 cursor-pointer break-inside-avoid shadow-sm hover:shadow-xl transition-all duration-300"
        onClick={onClick}
      >
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
      <div
        className="group relative border border-gray-100 rounded-lg overflow-hidden bg-gray-100 cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300"
        onClick={onClick}
      >
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
    <div
      className="group relative border border-gray-100 rounded-lg overflow-hidden bg-gray-100 cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300"
      onClick={onClick}
    >
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

export default function GalleryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <GalleryContent />
    </Suspense>
  );
}