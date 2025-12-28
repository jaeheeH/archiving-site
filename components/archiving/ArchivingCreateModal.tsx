"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import CategorySelectModal from "@/components/CategorySelectModal";

interface ArchivingCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Category = {
  id: number;
  name: string;
  slug: string;
};

export default function ArchivingCreateModal({
  open,
  onClose,
  onSuccess,
}: ArchivingCreateModalProps) {
  const supabase = createClient();
  const { addToast } = useToast();

  // 폼 상태
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // 범주
  const [rangeOpen, setRangeOpen] = useState(false);
  const [range, setRange] = useState<string[]>([]);
  const [rangeCategories, setRangeCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // UI 상태
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  // 범주 로드
  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const res = await fetch("/api/archiving-categories");

      if (!res.ok) {
        throw new Error("범주 로드 실패");
      }

      const { data } = await res.json();
      const categoryNames = data.map((cat: Category) => cat.name);
      setRangeCategories(categoryNames);
    } catch (error: any) {
      console.error("❌ 범주 로드 에러:", error);
      addToast("범주 로드 실패", "error");
    } finally {
      setLoadingCategories(false);
    }
  };

  // 이미지 리사이징 함수
  const resizeImage = async (file: File, maxWidth: number, maxHeight: number): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // 캔버스로 리사이징
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // 비율 유지하면서 최대 크기로 조정
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Failed to create blob"));
              return;
            }
            const resizedFile = new File([blob], file.name, { type: "image/webp" });
            resolve(resizedFile);
          }, "image/webp", 0.8);
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  // 이미지 업로드 함수
  const uploadImage = async (file: File, folder: string = "original") => {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `archiving/${folder}/${fileName}`;

    const { error } = await supabase.storage
      .from("archiving")
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from("archiving")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  // 썸네일 생성 및 업로드 함수
  const uploadWithThumbnail = async (file: File) => {
    try {
      // 1. 원본 이미지 업로드
      const originalUrl = await uploadImage(file, "original");

      // 2. 썸네일 생성 및 업로드
      const resizedFile = await resizeImage(file, 48, 32);
      const ext = resizedFile.name.split(".").pop();
      const fileName = `${Date.now()}.${ext}`;
      const filePath = `archiving/thumbnails/${fileName}`;

      const { error } = await supabase.storage
        .from("archiving")
        .upload(filePath, resizedFile);

      if (error) throw error;

      const { data } = supabase.storage
        .from("archiving")
        .getPublicUrl(filePath);

      const thumbnailUrl = data.publicUrl;

      // 원본 URL 반환 (썸네일은 별도로 저장 시 사용)
      return {
        original: originalUrl,
        thumbnail: thumbnailUrl,
      };
    } catch (error) {
      console.error("이미지 업로드 실패:", error);
      throw error;
    }
  };

  // 유효성 검사
  const validateForm = (): boolean => {
    if (!title.trim()) {
      addToast("제목을 입력하세요.", "error");
      return false;
    }

    if (!url.trim()) {
      addToast("URL을 입력하세요.", "error");
      return false;
    }

    if (!imageFile) {
      addToast("이미지를 업로드하세요.", "error");
      return false;
    }

    // URL 형식 검증
    try {
      new URL(url);
    } catch {
      addToast("올바른 URL 형식을 입력하세요.", "error");
      return false;
    }

    return true;
  };

  // 저장
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      // 1. 이미지 업로드 (원본 + 썸네일)
      const { original, thumbnail } = await uploadWithThumbnail(imageFile!);

      // 2. API를 통해 아카이빙 생성
      const res = await fetch("/api/archiving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          url: url.trim(),
          image_url: thumbnail, // 대시보드: 썸네일 사용
          image_original: original, // 클라이언트: 원본 사용
          range: range.length > 0 ? range : [],
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "저장 실패");
      }

      addToast("아카이빙이 저장되었습니다!", "success");
      
      // 폼 초기화
      resetForm();
      onClose();
      onSuccess?.();
    } catch (error: any) {
      console.error("❌ 아카이빙 생성 에러:", error);
      addToast(`에러: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // 폼 초기화
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setUrl("");
    setImageFile(null);
    setImagePreview(null);
    setRange([]);
  };

  // 모달 닫기
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // 이미지 파일 선택 핸들러
  const handleImageChange = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Drag & Drop 핸들러
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImageChange(file);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">아카이빙 추가</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* 폼 내용 */}
        <div className="p-6 flex flex-col gap-4">
          {/* 📌 제목 (필수) */}
          <div className="form-label">
            <label htmlFor="archiving-title">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              id="archiving-title"
              className="border p-2 rounded w-full input-text-36"
              placeholder="아카이빙 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* 📌 설명 (선택) */}
          <div className="form-label">
            <label htmlFor="archiving-description">설명</label>
            <textarea
              id="archiving-description"
              className="border p-2 rounded w-full textArea"
              placeholder="아카이빙에 대한 설명"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* 📌 URL (필수) */}
          <div className="form-label">
            <label htmlFor="archiving-url">
              URL <span className="text-red-500">*</span>
            </label>
            <input
              id="archiving-url"
              className="border p-2 rounded w-full input-text-36"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              type="url"
            />
            <p className="text-xs text-gray-500 mt-1">
              유효한 URL 형식으로 입력하세요.
            </p>
          </div>

          {/* 🟢 범주 (필수) */}
          <div className="form-label">
            <label>
              범주 <span className="text-red-500">*</span>
            </label>
            <div
              className="border rounded p-2 cursor-pointer hover:bg-gray-50"
              onClick={() => setRangeOpen(true)}
            >
              {range.length === 0 ? "범주 선택" : range.join(", ")}
            </div>

            <CategorySelectModal
              open={rangeOpen}
              setOpen={setRangeOpen}
              selected={range}
              setSelected={setRange}
              categories={rangeCategories}
              max={3}
            />
          </div>

          {/* 📌 이미지 (필수) - Drag & Drop */}
          <div className="form-label">
            <label>
              썸네일 이미지 <span className="text-red-500">*</span>
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                isDragging ? "bg-blue-50 border-blue-400" : "border-gray-300"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("archivingImageInput")?.click()}
            >
              <input
                id="archivingImageInput"
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleImageChange(e.target.files[0]);
                  }
                }}
                disabled={loading}
              />

              {imagePreview ? (
                <div className="space-y-2">
                  <img
                    src={imagePreview}
                    alt="미리보기"
                    className="mx-auto max-h-72 rounded"
                  />
                  <p className="text-xs text-gray-500">
                    다른 이미지를 선택하려면 클릭하세요.
                  </p>
                </div>
              ) : (
                <div className="text-gray-500 space-y-2">
                  <p>
                    <i className="ri-image-add-line text-2xl"></i>
                  </p>
                  <p>이미지를 드래그하거나 클릭하여 업로드</p>
                  <p className="text-xs">지원 형식: JPG, PNG, WebP 등</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 푸터 - 버튼 */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-2 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
            disabled={loading}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}