"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import CategorySelectModal from "@/components/CategorySelectModal";

interface ReferenceCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Category = {
  id: number;
  name: string;
  slug: string;
};

const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REFERENCE_LOGO_BYTES = 4 * 1024 * 1024;
const ALLOWED_REFERENCE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function validateImageFile(file: File, maxBytes: number) {
  if (!ALLOWED_REFERENCE_IMAGE_TYPES.has(file.type)) {
    return "JPG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다.";
  }

  if (file.size > maxBytes) {
    return `이미지는 최대 ${Math.floor(maxBytes / 1024 / 1024)}MB까지 업로드할 수 있습니다.`;
  }

  return null;
}

function toWebpFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") + ".webp";
}

export default function ReferenceCreateModal({
  open,
  onClose,
  onSuccess,
}: ReferenceCreateModalProps) {
  const { addToast } = useToast();

  // 폼 상태
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // 범주
  const [rangeOpen, setRangeOpen] = useState(false);
  const [range, setRange] = useState<string[]>([]);
  const [rangeCategories, setRangeCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // UI 상태
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadCategories() {
    try {
      setLoadingCategories(true);
      const res = await fetch("/api/references-categories");

      if (!res.ok) {
        throw new Error("범주 로드 실패");
      }

      const { data } = await res.json();
      const categoryNames = data.map((cat: Category) => cat.name);
      setRangeCategories(categoryNames);
    } catch (error: unknown) {
      console.error("❌ 범주 로드 에러:", error);
      addToast("범주 로드 실패", "error");
    } finally {
      setLoadingCategories(false);
    }
  }

  // 범주 로드
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadCategories();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

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
            const resizedFile = new File([blob], toWebpFileName(file.name), { type: "image/webp" });
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
  const uploadReferenceAsset = async (file: File, kind: "thumbnail" | "logo") => {
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", file);

    const res = await fetch("/api/references/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "이미지 업로드 실패");
    }

    return data.url as string;
  };

  // 로고 업로드 함수
  const uploadLogo = async (file: File) => {
    return uploadReferenceAsset(file, "logo");
  };

  // 썸네일 생성 및 업로드 함수
  const uploadWithThumbnail = async (file: File) => {
    try {
      // 레퍼런스 목록에서는 썸네일만 사용하므로 원본 업로드는 생략한다.
      const resizedFile = await resizeImage(file, 640, 1080);
      return uploadReferenceAsset(resizedFile, "thumbnail");
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
      addToast("썸네일 이미지를 업로드하세요.", "error");
      return false;
    }

    if (!logoFile) {
      addToast("로고 이미지를 업로드하세요.", "error");
      return false;
    }

    if (range.length === 0) {
      addToast("범주를 선택하세요.", "error");
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

      // 1. 이미지 업로드 (썸네일만 저장)
      const thumbnail = await uploadWithThumbnail(imageFile!);

      // 2. 로고 업로드
      const logoUrl = await uploadLogo(logoFile!);

      // 3. API를 통해 레퍼런스 생성
      const res = await fetch("/api/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          url: url.trim(),
          image_url: thumbnail, // 대시보드: 썸네일 사용
          logo_url: logoUrl, // 로고 URL
          range: range.length > 0 ? range : [],
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "저장 실패");
      }

      addToast("레퍼런스가 저장되었습니다!", "success");
      
      // 폼 초기화
      resetForm();
      onClose();
      onSuccess?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "레퍼런스 생성 중 오류가 발생했습니다.";
      console.error("❌ 레퍼런스 생성 에러:", error);
      addToast(`에러: ${message}`, "error");
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
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setLogoFile(null);
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    setRange([]);
  };

  // 모달 닫기
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // 이미지 파일 선택 핸들러
  const handleImageChange = (file: File) => {
    const error = validateImageFile(file, MAX_REFERENCE_IMAGE_BYTES);
    if (error) {
      addToast(error, "error");
      return;
    }
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // 로고 파일 선택 핸들러
  const handleLogoChange = (file: File) => {
    const error = validateImageFile(file, MAX_REFERENCE_LOGO_BYTES);
    if (error) {
      addToast(error, "error");
      return;
    }
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  // Drag & Drop 핸들러
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
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
          <h2 className="text-lg font-semibold">레퍼런스 추가</h2>
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
            <label htmlFor="reference-title">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              id="reference-title"
              className="border p-2 rounded w-full input-text-36"
              placeholder="레퍼런스 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* 📌 설명 (선택) */}
          <div className="form-label">
            <label htmlFor="reference-description">설명</label>
            <textarea
              id="reference-description"
              className="border p-2 rounded w-full textArea"
              placeholder="레퍼런스에 대한 설명"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* 📌 URL (필수) */}
          <div className="form-label">
            <label htmlFor="reference-url">
              URL <span className="text-red-500">*</span>
            </label>
            <input
              id="reference-url"
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
              onClick={() => document.getElementById("referenceImageInput")?.click()}
            >
              <input
                id="referenceImageInput"
                type="file"
                hidden
                accept="image/jpeg,image/png,image/webp,image/gif"
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

          {/* 📌 로고 이미지 (필수) */}
          <div className="form-label">
            <label>
              사이트 로고 <span className="text-red-500">*</span>
            </label>
            <div
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition border-gray-300 hover:bg-gray-50"
              onClick={() => document.getElementById("referenceLogoInput")?.click()}
            >
              <input
                id="referenceLogoInput"
                type="file"
                hidden
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleLogoChange(e.target.files[0]);
                  }
                }}
                disabled={loading}
              />

              {logoPreview ? (
                <div className="space-y-2">
                  <img
                    src={logoPreview}
                    alt="로고 미리보기"
                    className="mx-auto max-h-32 rounded"
                  />
                  <p className="text-xs text-gray-500">
                    다른 로고를 선택하려면 클릭하세요.
                  </p>
                </div>
              ) : (
                <div className="text-gray-500 space-y-2">
                  <p>
                    <i className="ri-image-add-line text-2xl"></i>
                  </p>
                  <p>로고 이미지를 클릭하여 업로드</p>
                  <p className="text-xs">지원 형식: JPG, PNG, WebP 등 (정사각형 권장)</p>
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
