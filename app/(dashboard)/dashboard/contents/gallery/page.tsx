"use client";

import { useEffect, useState } from "react";
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

export default function GalleryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { addToast } = useToast();

  const pageFromUrl = Number(searchParams.get("page") || 1);

  const [viewMode, setViewMode] = useState<"masonry" | "grid" | "list">("masonry");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(pageFromUrl);
  const limit = 36;
  const [totalPages, setTotalPages] = useState(1);

  // 모달 상태
  const [editingId, setEditingId] = useState<number | null>(null);

  const updatePage = (pageNum: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageNum));
    router.push(`${pathname}?${params.toString()}`);
    setPage(pageNum);
  };

  const fetchGallery = async (pageNum = 1) => {
    try {
      setLoading(true);

      // ✅ API를 통해 갤러리 조회
      const res = await fetch(
        `/api/gallery?page=${pageNum}&limit=${limit}`
      );

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

  useEffect(() => {
    fetchGallery(page);
  }, [page]);

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
      // ✅ API를 통해 삭제
      const res = await fetch(`/api/gallery/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "삭제 실패");
      }

      addToast("삭제 완료!", "success");
      fetchGallery(page);
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
    fetchGallery(page);
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
        <div className="flex my-4 justify-between">
          <div className="search"></div>
          <div className="flex gap-3">
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
        </div>

        <div className={layoutClass}>
          {gallery.length === 0 && (
            <div className="text-gray-500 col-span-3">
              등록된 이미지가 없습니다.
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

        <div className="flex justify-center mt-6 gap-2">
          <button
            onClick={() => updatePage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            이전
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              onClick={() => updatePage(num)}
              className={`px-3 py-1 border rounded ${
                page === num ? "bg-black text-white" : ""
              }`}
            >
              {num}
            </button>
          ))}

          <button
            onClick={() => updatePage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            다음
          </button>
        </div>
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