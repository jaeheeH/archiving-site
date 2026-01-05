"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import CategorySelectModal from "@/components/CategorySelectModal";
import CategorySelect from "@/components/CategorySelect";

interface ReferenceEditModalProps {
  id: number;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ReferenceData {
  id: number;
  title: string;
  description: string | null;
  url: string;
  image_url: string;
  logo_url: string | null;
  category: string | null;
  range: string[] | null;
  clicks: number;
  created_at: string;
}

export default function ReferenceEditModal({
  id,
  onClose,
  onSuccess,
}: ReferenceEditModalProps) {
  const supabase = createClient();
  const { addToast } = useToast();

  // 폼 상태
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // 범주
  const [rangeOpen, setRangeOpen] = useState(false);
  const [range, setRange] = useState<string[]>([]);
  const [rangeCategories, setRangeCategories] = useState<string[]>([]);

  // UI 상태
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 범주 로드 함수
  const loadCategories = async () => {
    try {
      const res = await fetch("/api/references-categories");

      if (!res.ok) {
        throw new Error("범주 로드 실패");
      }

      const { data } = await res.json();
      const categoryNames = data.map((cat: any) => cat.name);
      setRangeCategories(categoryNames);
    } catch (error: any) {
      console.error("❌ 범주 로드 에러:", error);
      addToast("범주 로드 실패", "error");
    }
  };

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // 범주 로드
        await loadCategories();
        
        // 레퍼런스 데이터 로드
        const res = await fetch(`/api/references/${id}`);

        if (!res.ok) {
          throw new Error("데이터를 불러올 수 없습니다.");
        }

        const { data } = await res.json() as { data: ReferenceData };

        setTitle(data.title);
        setDescription(data.description || "");
        setUrl(data.url);
        setImageUrl(data.image_url);
        setImagePreview(data.image_url);
        setLogoUrl(data.logo_url || null);
        setLogoPreview(data.logo_url || null);
        setRange(data.range || []);
      } catch (error: any) {
        console.error("❌ 데이터 로드 에러:", error);
        addToast(`에러: ${error.message}`, "error");
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

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
    const filePath = `references/${folder}/${fileName}`;

    const { error } = await supabase.storage
      .from("references")
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from("references")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  // 로고 업로드 함수
  const uploadLogo = async (file: File) => {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `references/logos/${fileName}`;

    const { error } = await supabase.storage
      .from("references")
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from("references")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  // 썸네일 생성 및 업로드 함수
  const uploadWithThumbnail = async (file: File) => {
    try {
      // 1. 원본 이미지 업로드
      const originalUrl = await uploadImage(file, "original");

      // 2. 썸네일 생성 및 업로드 (폭 640px로 리사이징)
      const resizedFile = await resizeImage(file, 640, 1080);
      const ext = resizedFile.name.split(".").pop();
      const fileName = `${Date.now()}.${ext}`;
      const filePath = `references/thumbnails/${fileName}`;

      const { error } = await supabase.storage
        .from("references")
        .upload(filePath, resizedFile);

      if (error) throw error;

      const { data } = supabase.storage
        .from("references")
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
      setSaving(true);

      let finalImageUrl = imageUrl;
      let finalImageOriginal = imageUrl; // 기존 원본 이미지
      let finalLogoUrl = logoUrl; // 기존 로고 URL

      // 새 이미지가 업로드된 경우
      if (imageFile) {
        const { original, thumbnail } = await uploadWithThumbnail(imageFile);
        finalImageUrl = thumbnail;
        finalImageOriginal = original;
      }

      // 새 로고가 업로드된 경우
      if (logoFile) {
        finalLogoUrl = await uploadLogo(logoFile);
      }

      // API를 통해 레퍼런스 수정
      const res = await fetch(`/api/references/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          url: url.trim(),
          image_url: finalImageUrl, // 대시보드: 썸네일 사용
          image_original: finalImageOriginal, // 클라이언트: 원본 사용
          logo_url: finalLogoUrl, // 로고 URL
          range: range.length > 0 ? range : [],
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "수정 실패");
      }

      addToast("레퍼런스가 수정되었습니다!", "success");
      onClose();
      onSuccess?.();
    } catch (error: any) {
      console.error("❌ 레퍼런스 수정 에러:", error);
      addToast(`에러: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // 이미지 파일 선택 핸들러
  const handleImageChange = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // 로고 파일 선택 핸들러
  const handleLogoChange = (file: File) => {
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
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

  if (loading) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <p>불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">레퍼런스 수정</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        {/* 폼 내용 */}
        <div className="p-6 flex flex-col gap-4">
          {/* 📌 제목 (필수) */}
          <div className="form-label">
            <label htmlFor="reference-title-edit">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              id="reference-title-edit"
              className="border p-2 rounded w-full input-text-36"
              placeholder="레퍼런스 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* 📌 설명 (선택) */}
          <div className="form-label">
            <label htmlFor="reference-description-edit">설명</label>
            <textarea
              id="reference-description-edit"
              className="border p-2 rounded w-full textArea"
              placeholder="레퍼런스에 대한 설명"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* 📌 URL (필수) */}
          <div className="form-label">
            <label htmlFor="reference-url-edit">
              URL <span className="text-red-500">*</span>
            </label>
            <input
              id="reference-url-edit"
              className="border p-2 rounded w-full input-text-36"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={saving}
              type="url"
            />
            <p className="text-xs text-gray-500 mt-1">
              유효한 URL 형식으로 입력하세요.
            </p>
          </div>

          {/* 🟢 범주 (선택) */}
          <div className="form-label">
            <label>범주</label>
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
            <label>썸네일 이미지</label>
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
              onClick={() => document.getElementById("referenceImageInputEdit")?.click()}
            >
              <input
                id="referenceImageInputEdit"
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleImageChange(e.target.files[0]);
                  }
                }}
                disabled={saving}
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

          {/* 📌 로고 이미지 */}
          <div className="form-label">
            <label>사이트 로고</label>
            <div
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition border-gray-300 hover:bg-gray-50"
              onClick={() => document.getElementById("referenceLogoInputEdit")?.click()}
            >
              <input
                id="referenceLogoInputEdit"
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleLogoChange(e.target.files[0]);
                  }
                }}
                disabled={saving}
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
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
            disabled={saving}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}