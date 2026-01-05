"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";

interface ReferenceCategoryModalProps {
  open: boolean;
  mode: "create" | "edit";
  id?: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ReferenceCategoryModal({
  open,
  mode,
  id,
  onClose,
  onSuccess,
}: ReferenceCategoryModalProps) {
  const { addToast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  // 수정 모드일 때 데이터 로드
  useEffect(() => {
    if (mode === "edit" && id && open) {
      loadData();
    }
  }, [mode, id, open]);

  const loadData = async () => {
    try {
      setInitialLoading(true);
      const res = await fetch(`/api/references-categories/${id}`);

      if (!res.ok) {
        throw new Error("데이터를 불러올 수 없습니다.");
      }

      const { data } = await res.json();
      setName(data.name);
      setDescription(data.description || "");
    } catch (error: any) {
      console.error("❌ 데이터 로드 에러:", error);
      addToast(`에러: ${error.message}`, "error");
      onClose();
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      addToast("범주명을 입력하세요.", "error");
      return;
    }

    try {
      setLoading(true);

      const url =
        mode === "create"
          ? "/api/references-categories"
          : `/api/references-categories/${id}`;

      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "저장 실패");
      }

      addToast(
        mode === "create"
          ? "범주가 추가되었습니다!"
          : "범주가 수정되었습니다!",
        "success"
      );

      resetForm();
      onClose();
      onSuccess?.();
    } catch (error: any) {
      console.error("❌ 저장 에러:", error);
      addToast(`에러: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "범주 추가" : "범주 수정"}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
            disabled={loading || initialLoading}
          >
            ✕
          </button>
        </div>

        {/* 폼 */}
        {initialLoading ? (
          <div className="text-center py-6 text-gray-500">
            불러오는 중...
          </div>
        ) : (
          <div className="space-y-4">
            {/* 범주명 */}
            <div className="form-label">
              <label htmlFor="category-name">
                범주명 <span className="text-red-500">*</span>
              </label>
              <input
                id="category-name"
                type="text"
                className="border p-2 rounded w-full input-text-36"
                placeholder="예: UI/UX"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Slug는 자동으로 생성됩니다.
              </p>
            </div>

            {/* 설명 */}
            <div className="form-label">
              <label htmlFor="category-description">설명</label>
              <textarea
                id="category-description"
                className="border p-2 rounded w-full textArea"
                placeholder="범주에 대한 설명"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={3}
              />
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-2 justify-end mt-6">
          <button
            onClick={handleClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
            disabled={loading || initialLoading}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={loading || initialLoading}
          >
            {loading ? "저장 중..." : mode === "create" ? "추가" : "수정"}
          </button>
        </div>
      </div>
    </div>
  );
}