'use client';

import { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import ClientGalleryDetailModal from '@/components/gallery/ClientGalleryDetailModal';

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

function GalleryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // URL에서 파라미터 가져오기
  const pageFromUrl = Number(searchParams.get('page') || 1);
  const searchFromUrl = searchParams.get('search') || '';
  const tagsFromUrl = searchParams.get('tags') || '';

  // 상태 관리
  const [viewMode, setViewMode] = useState<'masonry' | 'grid' | 'list'>('masonry');
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  // 검색 디바운싱 (300ms)
  const [debouncedSearch, setDebouncedSearch] = useState(searchFromUrl);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 검색어 변경 시 페이지 1로 리셋
  useEffect(() => {
    if (debouncedSearch !== searchFromUrl) {
      setPage(1);
    }
  }, [debouncedSearch]);

  // URL 업데이트 (히스토리 쌓지 않고 replace)
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));

    if (debouncedSearch.trim()) {
      params.set('search', debouncedSearch.trim());
    }

    if (selectedTags.length > 0) {
      params.set('tags', selectedTags.join(','));
    }

    const newUrl = `${pathname}?${params.toString()}`;
    if (window.location.search !== `?${params.toString()}`) {
      router.replace(newUrl);
    }
  }, [page, debouncedSearch, selectedTags, pathname, router]);

  // 갤러리 데이터 조회
  const fetchGallery = async (pageNum: number, search: string, tags: string[]) => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('limit', String(limit));

      if (search.trim()) {
        params.set('search', search.trim());
      }

      if (tags.length > 0) {
        params.set('tags', tags.join(','));
      }

      const res = await fetch(`/api/gallery?${params.toString()}`);

      if (!res.ok) {
        throw new Error('갤러리 조회 실패');
      }

      const data = await res.json();

      setGallery(data.data || []);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('❌ Fetch 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  // 상위 10개 태그 조회
  const fetchTopTags = async () => {
    try {
      setLoadingTags(true);
      const res = await fetch('/api/gallery/tags/top');

      if (!res.ok) {
        throw new Error('태그 조회 실패');
      }

      const data = await res.json();
      setTopTags(data.tags || []);
    } catch (error) {
      console.error('❌ 태그 조회 에러:', error);
    } finally {
      setLoadingTags(false);
    }
  };

  // 검색어 변경
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
  };

  // 태그 토글
  const handleTagToggle = (tag: string) => {
    setPage(1);

    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];

    setSelectedTags(newTags);
  };

  // 페이지 변경
  const updatePage = (pageNum: number) => {
    setPage(pageNum);
  };

  // 검색어/필터 변경 시 갤러리 재조회
  useEffect(() => {
    fetchGallery(page, debouncedSearch, selectedTags);
  }, [page, debouncedSearch, selectedTags]);

  // 초기 로드
  useEffect(() => {
    fetchTopTags();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('gallery_view_mode');
    if (saved === 'masonry' || saved === 'grid' || saved === 'list') {
      setViewMode(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('gallery_view_mode', viewMode);
  }, [viewMode]);

  if (loading && gallery.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>불러오는 중...</p>
      </div>
    );
  }

  const layoutClass = {
    masonry: 'columns-2 sm:columns-2 md:columns-4 lg:columns-5 xl:columns-6 gap-2 space-y-2',
    grid: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2',
    list: 'gap-2 grid grid-cols-2',
  }[viewMode];

  return (
    <div className="min-h-screen contents mx-auto py-12">
      <div className="max-w-7xl mx-auto  mb-8">
        <h1 className="text-4xl md:text-4xl font-bold tracking-tight text-gray-900 mb-4">
          EXHIBITION EVENT <br></br>
          SCHEDULE
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl leading-relaxed ">
            서울을 중심으로 열리는 주요 전시, <br></br>
            디자인 컨퍼런스, 팝업 스토어 일정을 큐레이션합니다.
          </p>
      </div>
      <div>
        {/* 검색 및 필터 */}
        <div className="mb-6 space-y-4">
          {/* 검색창 및 뷰 모드 */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="제목, 설명, 태그로 검색..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('masonry')}
                className={`px-3 py-2 border rounded ${
                  viewMode === 'masonry'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                <i className="ri-layout-masonry-line"></i>
              </button>

              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 border rounded ${
                  viewMode === 'grid'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                <i className="ri-layout-grid-line"></i>
              </button>

              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 border rounded ${
                  viewMode === 'list'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                <i className="ri-list-view"></i>
              </button>
            </div>
          </div>

          {/* 태그 필터 */}
          {!loadingTags && topTags.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              {topTags.map((item) => (
                <button
                  key={item.tag}
                  onClick={() => handleTagToggle(item.tag)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    selectedTags.includes(item.tag)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                  }`}
                >
                  {item.tag} ({item.count})
                </button>
              ))}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => {
                    setPage(1);
                    setSelectedTags([]);
                  }}
                  className="px-3 py-1 text-sm text-red-500 hover:text-red-700"
                >
                  <i className="ri-close-line"></i> 필터 초기화
                </button>
              )}
            </div>
          )}

          {/* 검색 결과 정보 */}
          {(debouncedSearch || selectedTags.length > 0) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <i className="ri-filter-line"></i>
              {debouncedSearch && (
                <span>
                  검색: <strong>{debouncedSearch}</strong>
                </span>
              )}
              {selectedTags.length > 0 && (
                <span>
                  {debouncedSearch && ' / '} 태그: <strong>{selectedTags.join(', ')}</strong>
                </span>
              )}
              <span className="ml-2">총 {gallery.length}개</span>
            </div>
          )}
        </div>

        {/* 갤러리 그리드 */}
        <div className={layoutClass}>
          {gallery.length === 0 && (
            <div className="text-gray-500 col-span-full text-center py-12">
              {debouncedSearch || selectedTags.length > 0
                ? '검색 결과가 없습니다.'
                : '등록된 이미지가 없습니다.'}
            </div>
          )}

          {gallery.map((item) => (
            <GalleryItemImage
              key={item.id}
              item={item}
              viewMode={viewMode}
              onClick={() => setSelectedId(item.id)}
            />
          ))}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8 gap-2">
            <button
              onClick={() => updatePage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border rounded disabled:opacity-50 bg-white hover:bg-gray-50"
            >
              이전
            </button>

            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
              const pageNum = i + 1 + Math.floor((page - 1) / 10) * 10;
              if (pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => updatePage(pageNum)}
                  className={`px-4 py-2 border rounded ${
                    page === pageNum
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => updatePage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border rounded disabled:opacity-50 bg-white hover:bg-gray-50"
            >
              다음
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

/**
 * 갤러리 아이템 이미지 컴포넌트
 * Masonry/Grid/List 레이아웃에 따라 다르게 렌더링
 */
function GalleryItemImage({
  item,
  viewMode,
  onClick,
}: {
  item: GalleryItem;
  viewMode: 'masonry' | 'grid' | 'list';
  onClick: () => void;
}) {
  if (viewMode === 'masonry') {
    // Masonry: 원본 비율 유지
    return (
      <div
        className="group relative border rounded-lg overflow-hidden bg-white hover:shadow-lg transition cursor-pointer break-inside-avoid"
        onClick={onClick}
      >
        <div className="relative w-full" style={{ aspectRatio: `${item.image_width} / ${item.image_height}` }}>
          <Image
            src={item.image_url}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 90vw, 600px"  // 이대로 OK
            quality={75}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            placeholder="blur"
            blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23f3f4f6' width='16' height='9'/%3E%3C/svg%3E"
          />
        </div>
      </div>
    );
  }

  if (viewMode === 'grid') {
    // Grid: 정사각형 비율
    return (
      <div
        className="group relative border rounded-lg overflow-hidden bg-white hover:shadow-lg transition cursor-pointer"
        onClick={onClick}
      >
        <div className="relative w-full aspect-square">
          <Image
            src={item.image_url}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            placeholder="blur"
            blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect fill='%23f3f4f6' width='1' height='1'/%3E%3C/svg%3E"
          />
        </div>
      </div>
    );
  }

  // List: 고정 높이
  return (
    <div
      className="group relative border rounded-lg overflow-hidden bg-white hover:shadow-lg transition cursor-pointer"
      onClick={onClick}
    >
      <div className="relative w-full h-48">
        <Image
          src={item.image_url}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          placeholder="blur"
          blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23f3f4f6' width='16' height='9'/%3E%3C/svg%3E"
        />
      </div>
    </div>
  );
}

export default function GalleryPage() {
  return (
    <Suspense fallback={<div className="p-6">불러오는 중...</div>}>
      <GalleryContent />
    </Suspense>
  );
}