"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import DashboardTitle from "@/app/(dashboard)/components/DashboardHeader";
import ArchivingTableRow from "@/components/archiving/ArchivingTableRow";
import ArchivingCreateModal from "@/components/archiving/ArchivingCreateModal";
import ArchivingEditModal from "@/components/archiving/ArchivingEditModal";

type ArchivingItem = {
  id: number;
  title: string;
  description: string | null;
  url: string;
  image_url: string;
  category: string | null;
  range: string[] | null;
  clicks: number;
  created_at: string;
};

function ArchivingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { addToast } = useToast();

  const pageFromUrl = Number(searchParams.get("page") || 1);

  // 데이터 상태
  const [archiving, setArchiving] = useState<ArchivingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 페이지네이션
  const [page, setPage] = useState(pageFromUrl);
  const limit = 15;
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 필터 & 정렬
  const [selectedRange, setSelectedRange] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"created_at" | "title" | "clicks">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 체크박스 선택
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // 모달 상태
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // 범주 옵션
  const [ranges, setRanges] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // 범주 로드
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const res = await fetch("/api/archiving-categories");

      if (!res.ok) {
        throw new Error("범주 로드 실패");
      }

      const { data } = await res.json();
      const categoryNames = data.map((cat: any) => cat.name);
      setRanges(categoryNames);
    } catch (error: any) {
      console.error("❌ 범주 로드 에러:", error);
      addToast("범주 로드 실패", "error");
    } finally {
      setLoadingCategories(false);
    }
  };

  // 페이지 업데이트
  const updatePage = (pageNum: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageNum));
    router.push(`${pathname}?${params.toString()}`);
    setPage(pageNum);
  };

  // 데이터 조회
  const fetchArchiving = async (pageNum = 1) => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("limit", String(limit));
      params.set("sort", sortBy);
      params.set("order", sortOrder);
      if (selectedRange) {
        params.set("category", selectedRange);
      }

      const res = await fetch(`/api/archiving?${params.toString()}`);

      if (!res.ok) {
        throw new Error("아카이빙 조회 실패");
      }

      const data = await res.json();

      setArchiving(data.data || []);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.total);
      setSelectedIds([]); // 페이지 변경 시 선택 초기화
    } catch (error: any) {
      console.error("❌ Fetch 에러:", error);
      addToast("아카이빙 조회 실패", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchiving(page);
  }, [page, selectedRange, sortBy, sortOrder]);

  // 개별 아이템 선택
  const handleSelectItem = (id: number, selected: boolean) => {
    if (selected) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  // 모두 선택/해제
  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(archiving.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  // 개별 삭제
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/archiving/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "삭제 실패");
      }

      addToast("삭제되었습니다!", "success");
      fetchArchiving(page);
    } catch (error: any) {
      console.error("❌ 삭제 에러:", error);
      addToast(`삭제 실패: ${error.message}`, "error");
    }
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      addToast("선택된 항목이 없습니다.", "error");
      return;
    }

    if (!confirm(`${selectedIds.length}개의 아카이빙을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const res = await fetch("/api/archiving/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "삭제 실패");
      }

      addToast(`${selectedIds.length}개 삭제되었습니다!`, "success");
      setSelectedIds([]);
      fetchArchiving(page);
    } catch (error: any) {
      console.error("❌ 일괄 삭제 에러:", error);
      addToast(`삭제 실패: ${error.message}`, "error");
    }
  };

  if (loading && archiving.length === 0) {
    return <div className="p-6">불러오는 중...</div>;
  }

  return (
    <div>
      {/* 헤더 */}
      <header className="dashboard-Header">
        <DashboardTitle title="아카이빙 목록" />
        <div className="flex gap-2 items-center">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              <i className="ri-delete-bin-line mr-1"></i>
              {selectedIds.length}개 삭제
            </button>
          )}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            <i className="ri-add-line mr-1"></i>
            추가
          </button>
        </div>
      </header>

      <div className="dashboard-container">
        {/* 필터 & 정렬 */}
        <div className="flex justify-between items-center mb-4 pb-4 border-b">
          {/* 범주 탭 필터 */}
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => {
                setSelectedRange(null);
                setPage(1);
              }}
              className={`px-3 py-2 text-sm rounded whitespace-nowrap transition ${
                selectedRange === null
                  ? "bg-black text-white"
                  : "border text-gray-600 hover:bg-gray-100"
              }`}
            >
              전체
            </button>
            {ranges.map((range) => (
              <button
                key={range}
                onClick={() => {
                  setSelectedRange(range);
                  setPage(1);
                }}
                className={`px-3 py-2 text-sm rounded whitespace-nowrap transition ${
                  selectedRange === range
                    ? "bg-black text-white"
                    : "border text-gray-600 hover:bg-gray-100"
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* 정렬 옵션 */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as "created_at" | "title" | "clicks");
                setPage(1);
              }}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="created_at">최신순</option>
              <option value="title">제목순</option>
              <option value="clicks">인기순</option>
            </select>

            <button
              onClick={() => {
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                setPage(1);
              }}
              className="px-3 py-2 border rounded text-sm hover:bg-gray-100"
              title={sortOrder === "asc" ? "오름차순" : "내림차순"}
            >
              <i
                className={`ri-arrow-${
                  sortOrder === "asc" ? "up" : "down"
                }-line`}
              ></i>
            </button>
          </div>
        </div>

        {/* 테이블 */}
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                {/* 체크박스 */}
                <th className="p-3 w-12">
                  <input
                    type="checkbox"
                    checked={
                      archiving.length > 0 &&
                      selectedIds.length === archiving.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded cursor-pointer"
                  />
                </th>
                {/* 헤더들 */}
                <th className="text-left p-3 font-medium text-sm text-gray-700">
                  제목
                </th>
                <th className="text-left p-3 font-medium text-sm text-gray-700">
                  설명
                </th>
                <th className="text-left p-3 font-medium text-sm text-gray-700">
                  URL
                </th>
                <th className="text-center p-3 font-medium text-sm text-gray-700">
                  클릭수
                </th>
                <th className="text-center p-3 font-medium text-sm text-gray-700">
                  수정
                </th>
                <th className="text-center p-3 font-medium text-sm text-gray-700">
                  삭제
                </th>
              </tr>
            </thead>
            <tbody>
              {archiving.length > 0 ? (
                archiving.map((item) => (
                  <ArchivingTableRow
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    description={item.description}
                    url={item.url}
                    image_url={item.image_url}
                    clicks={item.clicks}
                    created_at={item.created_at}
                    isSelected={selectedIds.includes(item.id)}
                    onSelect={handleSelectItem}
                    onEdit={() => setEditingId(item.id)}
                    onDelete={handleDelete}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
                    아카이빙이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 정보 */}
        <div className="mt-4 text-sm text-gray-600">
          총 {totalCount}개 중 {(page - 1) * limit + 1}-
          {Math.min(page * limit, totalCount)}개 표시
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6 gap-2">
            <button
              onClick={() => updatePage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
            >
              이전
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => updatePage(num)}
                className={`px-3 py-1 border rounded ${
                  page === num
                    ? "bg-black text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                {num}
              </button>
            ))}

            <button
              onClick={() => updatePage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
            >
              다음
            </button>
          </div>
        )}
      </div>

      {/* 생성 모달 */}
      <ArchivingCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          setPage(1);
          fetchArchiving(1);
        }}
      />

      {/* 수정 모달 */}
      {editingId !== null && (
        <ArchivingEditModal
          id={editingId}
          onClose={() => setEditingId(null)}
          onSuccess={() => {
            setEditingId(null);
            fetchArchiving(page);
          }}
        />
      )}
    </div>
  );
}

export default function ArchivingPage() {
  return (
    <Suspense fallback={<div className="p-6">불러오는 중...</div>}>
      <ArchivingContent />
    </Suspense>
  );
}