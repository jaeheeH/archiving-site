"use client";

import { useEffect, useState, Suspense } from "react";
import { useToast } from "@/components/ToastProvider";
import DashboardTitle from "@/app/(dashboard)/components/DashboardHeader";
import ArchivingCategoryRow from "@/components/archiving/ArchivingCategoryRow";
import ArchivingCategoryModal from "@/components/archiving/ArchivingCategoryModal";

type Category = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
};

function ArchivingCategoryContent() {
  const { addToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);

  // 데이터 조회
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/archiving-categories");

      if (!res.ok) {
        throw new Error("범주 목록 조회 실패");
      }

      const { data } = await res.json();
      setCategories(data);
    } catch (error: any) {
      console.error("❌ Fetch 에러:", error);
      addToast("범주 목록 조회 실패", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // 추가 버튼
  const handleCreateClick = () => {
    setModalMode("create");
    setEditingId(null);
    setModalOpen(true);
  };

  // 수정 버튼
  const handleEditClick = (id: number) => {
    setModalMode("edit");
    setEditingId(id);
    setModalOpen(true);
  };

  // 삭제
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/archiving-categories/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "삭제 실패");
      }

      addToast("범주가 삭제되었습니다!", "success");
      fetchCategories();
    } catch (error: any) {
      console.error("❌ 삭제 에러:", error);
      addToast(`삭제 실패: ${error.message}`, "error");
    }
  };

  // 모달 닫기
  const handleModalClose = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  // 모달 성공
  const handleModalSuccess = () => {
    fetchCategories();
  };

  if (loading) {
    return <div className="p-6">불러오는 중...</div>;
  }

  return (
    <div>
      {/* 헤더 */}
      <header className="dashboard-Header">
        <DashboardTitle title="범주 관리" />
        <div className="flex gap-2 items-center">
          <button
            onClick={handleCreateClick}
            className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            <i className="ri-add-line mr-1"></i>
            범주 추가
          </button>
        </div>
      </header>

      <div className="dashboard-container">
        {/* 테이블 */}
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-sm text-gray-700">
                  범주명
                </th>
                <th className="text-left p-3 font-medium text-sm text-gray-700">
                  설명
                </th>
                <th className="text-left p-3 font-medium text-sm text-gray-700">
                  생성일
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
              {categories.length > 0 ? (
                categories.map((category) => (
                  <ArchivingCategoryRow
                    key={category.id}
                    id={category.id}
                    name={category.name}
                    description={category.description}
                    created_at={category.created_at}
                    onEdit={handleEditClick}
                    onDelete={handleDelete}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    범주가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 정보 */}
        <div className="mt-4 text-sm text-gray-600">
          총 {categories.length}개의 범주
        </div>
      </div>

      {/* 모달 */}
      <ArchivingCategoryModal
        open={modalOpen}
        mode={modalMode}
        id={editingId || undefined}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

export default function ArchivingCategoryPage() {
  return (
    <Suspense fallback={<div className="p-6">불러오는 중...</div>}>
      <ArchivingCategoryContent />
    </Suspense>
  );
}