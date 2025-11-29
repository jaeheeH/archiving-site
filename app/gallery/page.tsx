"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import ClientGalleryDetailModal from "@/components/gallery/ClientGalleryDetailModal";

type GalleryItem = {
  id: number;
  title: string;
  description?: string;
  image_url: string;
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
  const pageFromUrl = Number(searchParams.get("page") || 1);
  const searchFromUrl = searchParams.get("search") || "";
  const tagsFromUrl = searchParams.get("tags") || "";

  // 상태 관리
  const [viewMode, setViewMode] = useState<"masonry" | "grid" | "list">("masonry");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(pageFromUrl);
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    tagsFromUrl ? tagsFromUrl.split(",") : []
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
    params.set("page", String(page));

    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }

    if (selectedTags.length > 0) {
      params.set("tags", selectedTags.join(","));
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
      params.set("page", String(pageNum));
      params.set("limit", String(limit));

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (tags.length > 0) {
        params.set("tags", tags.join(","));
      }

      const res = await fetch(`/api/gallery?${params.toString()}`);

      if (!res.ok) {
        throw new Error("갤러리 조회 실패");
      }

      const data = await res.json();

      setGallery(data.data || []);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error("❌ Fetch 에러:", error);
    } finally {
      setLoading(false);
    }
  };

  // 상위 10개 태그 조회
  const fetchTopTags = async () => {
    try {
      setLoadingTags(true);
      const res = await fetch("/api/gallery/tags/top");

      if (!res.ok) {
        throw new Error("태그 조회 실패");
      }

      const data = await res.json();
      setTopTags(data.tags || []);
    } catch (error) {
      console.error("❌ 태그 조회 에러:", error);
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
    const saved = localStorage.getItem("gallery_view_mode");
    if (saved === "masonry" || saved === "grid" || saved === "list") {
      setViewMode(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("gallery_view_mode", viewMode);
  }, [viewMode]);

  if (loading && gallery.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>불러오는 중...</p>
      </div>
    );
  }

  const layoutClass = {
    masonry:
      "columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-4 gap-2 space-y-2",
    grid:
      "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2",
    list: "gap-2 grid grid-cols-2",
  }[viewMode];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">갤러리</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
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
                    setSearchInput("");
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
                onClick={() => setViewMode("masonry")}
                className={`px-3 py-2 border rounded ${
                  viewMode === "masonry"
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                <i className="ri-layout-masonry-line"></i>
              </button>

              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-2 border rounded ${
                  viewMode === "grid"
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                <i className="ri-layout-grid-line"></i>
              </button>

              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 border rounded ${
                  viewMode === "list"
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                <i className="ri-list-view"></i>
              </button>
            </div>
          </div>

          {/* 태그 필터 */}
          {!loadingTags && topTags.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium text-gray-600">태그 필터:</span>
              {topTags.map((item) => (
                <button
                  key={item.tag}
                  onClick={() => handleTagToggle(item.tag)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    selectedTags.includes(item.tag)
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-500"
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
                  {debouncedSearch && " / "} 태그: <strong>{selectedTags.join(", ")}</strong>
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
                ? "검색 결과가 없습니다."
                : "등록된 이미지가 없습니다."}
            </div>
          )}

          {gallery.map((item) => (
            <div
              key={item.id}
              className="group relative border rounded-lg overflow-hidden bg-white hover:shadow-lg transition cursor-pointer"
              onClick={() => setSelectedId(item.id)}
            >
              <div className="overflow-hidden">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className={
                    viewMode === "masonry"
                      ? "w-full h-auto object-cover"
                      : viewMode === "grid"
                      ? "w-full aspect-square object-cover"
                      : "w-full h-48 object-cover"
                  }
                />
              </div>
              <div className="p-4">
                <h2 className="font-medium text-sm mb-1">{item.title}</h2>
                {item.description && (
                  <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                    {item.description}
                  </p>
                )}
                {(item.gemini_tags || item.tags).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(item.gemini_tags || item.tags).slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-1 bg-gray-100 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white hover:bg-gray-50"
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

export default function GalleryPage() {
  return (
    <Suspense fallback={<div className="p-6">불러오는 중...</div>}>
      <GalleryContent />
    </Suspense>
  );
}
