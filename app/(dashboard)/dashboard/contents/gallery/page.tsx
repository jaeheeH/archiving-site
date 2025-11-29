"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

import GalleryCard from "@/components/gallery/GalleryCard";
import DashboardTitle from "@/app/(dashboard)/components/DashboardHeader";
import EditGalleryClient from "./[id]/edit/EditGalleryClient";

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
  const supabase = createClient();
  const { addToast } = useToast();

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
  const [editingId, setEditingId] = useState<number | null>(null);

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
      addToast("갤러리 조회 실패", "error");
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
    setPage(1); // 먼저 페이지 1로 리셋

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

  // 스크롤 고정
  useEffect(() => {
    if (editingId !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [editingId]);

  const deleteItem = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/gallery/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "삭제 실패");
      }

      addToast("삭제 완료!", "success");
      fetchGallery(page, debouncedSearch, selectedTags);
    } catch (error: any) {
      console.error("❌ 삭제 에러:", error);
      addToast(`삭제 실패: ${error.message}`, "error");
    }
  };

  const handleEditClick = (id: number) => {
    setEditingId(id);
  };

  const handleCloseModal = () => {
    setEditingId(null);
  };

  const handleSaveSuccess = () => {
    fetchGallery(page, debouncedSearch, selectedTags);
  };

  if (loading) return <div className="p-6">불러오는 중...</div>;

  const layoutClass = {
    masonry:
      "columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-6 gap-2 space-y-2",
    grid:
      "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2",
    list: "gap-2 grid grid-cols-2",
  }[viewMode];

  return (
    <div>
      <header className="dashboard-Header">
        <DashboardTitle title="갤러리 목록" />
        <div className="flex gap-2 items-center">
          <Link
            className="btn-link-primary btn-line-36"
            href="/dashboard/contents/gallery/create"
          >
            업로드
          </Link>
        </div>
      </header>

      <div className="dashboard-container">
        {/* 검색 및 필터 */}
        <div className="my-4 space-y-4">
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
            <div className="viewModeList gap-2 flex">
              <button
                onClick={() => setViewMode("masonry")}
                className={`border rounded ${
                  viewMode === "masonry" ? "on" : ""
                }`}
              >
                <i className="ri-layout-masonry-line"></i>
              </button>

              <button
                onClick={() => setViewMode("grid")}
                className={`border rounded ${viewMode === "grid" ? "on" : ""}`}
              >
                <i className="ri-layout-grid-line"></i>
              </button>

              <button
                onClick={() => setViewMode("list")}
                className={`border rounded ${viewMode === "list" ? "on" : ""}`}
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

        <div className={layoutClass}>
          {gallery.length === 0 && (
            <div className="text-gray-500 col-span-3">
              {debouncedSearch || selectedTags.length > 0
                ? "검색 결과가 없습니다."
                : "등록된 이미지가 없습니다."}
            </div>
          )}

          {gallery.map((item) => (
            <GalleryCard
              key={item.id}
              id={item.id}
              title={item.title}
              description={item.description}
              imageUrl={item.image_url}
              tags={item.gemini_tags || item.tags}
              viewMode={viewMode}
              onDelete={deleteItem}
              onEdit={handleEditClick}
            />
          ))}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6 gap-2">
            <button
              onClick={() => updatePage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
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
                  className={`px-3 py-1 border rounded ${
                    page === pageNum ? "bg-black text-white" : ""
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => updatePage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              다음
            </button>
          </div>
        )}
      </div>

      {/* 수정 모달 */}
      {editingId !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] modalContents"
            onClick={(e) => e.stopPropagation()}
          >
            <EditGalleryClient
              id={String(editingId)}
              onClose={handleCloseModal}
              onSaveSuccess={handleSaveSuccess}
            />
          </div>
        </div>
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
