"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import imageCompression from "browser-image-compression";

import TagInput from "@/components/TagInput";
import CategorySelectModal from "@/components/CategorySelectModal";
import CategorySelect from "@/components/CategorySelect";

const MAX_GALLERY_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_GALLERY_SOURCE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type GalleryUploadResult = {
  url: string;
  thumbnail_url: string;
};

interface EditGalleryClientProps {
  id: string;
  onClose?: () => void;
  onSaveSuccess?: () => void;
}

export default function EditGalleryClient({
  id,
  onClose,
  onSaveSuccess,
}: EditGalleryClientProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [geminiTags, setGeminiTags] = useState<string[]>([]);
  const [range, setRange] = useState<string[]>([]);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [geminiDescription, setGeminiDescription] = useState("");
  const [statusText, setStatusText] = useState("");
  const [loadError, setLoadError] = useState("");

  const setSelectedImage = (file: File) => {
    if (!ALLOWED_GALLERY_SOURCE_IMAGE_TYPES.has(file.type)) {
      addToast("JPG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다.", "error");
      return;
    }

    if (file.size > MAX_GALLERY_SOURCE_IMAGE_BYTES) {
      addToast("이미지는 8MB 이하로 업로드해주세요.", "error");
      return;
    }

    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedImage(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const rangeCategories = [
    "UI/UX",
    "산업 디자인",
    "그래픽 디자인",
    "건축",
    "브랜딩",
    "웹 디자인",
    "일러스트레이션",
    "모션 그래픽",
    "패션",
    "사진",
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/gallery/${id}?dashboard=true`, {
          cache: "no-store",
        });
        const result = await res.json();

        if (!res.ok) {
          if (res.status === 404) {
            const message = "이미지를 찾을 수 없습니다. 목록을 새로고침합니다.";
            addToast(message, "error");
            onSaveSuccess?.();
            onClose?.();
            setLoadError(message);
            setLoading(false);
            return;
          }

          throw new Error(result.error || "데이터를 불러올 수 없습니다");
        }

        const data = result.data;
        if (data) {
          setTitle(data.title);
          setDescription(data.description || "");
          setImageUrl(data.image_url);
          setThumbnailUrl(data.thumbnail_url || data.image_url);
          setTags(data.tags || []);
          setGeminiTags(data.gemini_tags || []);
          setRange(data.range || []);
          setCategory(data.category || "");
          setGeminiDescription(data.gemini_description || "");
        }

        setLoading(false);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "데이터 로드 중 오류가 발생했습니다";
        console.error("로드 에러:", error);
        addToast(message, "error");
        setLoading(false);
      }
    };

    load();
  }, [id, addToast, onClose, onSaveSuccess]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const uploadImage = async (file: File): Promise<GalleryUploadResult> => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/gallery/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "이미지 업로드 실패");
    }

    return {
      url: data.url as string,
      thumbnail_url: (data.thumbnail_url || data.url) as string,
    };
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const analyzeImage = async (imageUrl: string) => {
    const res = await fetch("/api/gallery/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl,
        title,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "이미지 분석 실패");
    }

    const data = await res.json();
    return data;
  };

  const save = async () => {
    try {
      setSaving(true);
  
      let finalImage = imageUrl;
      let finalThumbnail = thumbnailUrl || imageUrl;
      let finalEmbedding: number[] | undefined;
      let finalGeminiDescription = geminiDescription;
      let finalGeminiTags = geminiTags;
      let finalWidth: number | undefined;
      let finalHeight: number | undefined;
  
      // 새 이미지가 업로드된 경우
      if (imageFile) {
        setStatusText("이미지 최적화 중...");
        const optimizedFile = await imageCompression(imageFile, {
          maxSizeMB: 1.8,
          maxWidthOrHeight: 2200,
          useWebWorker: true,
          fileType: "image/jpeg",
          initialQuality: 0.86,
        });
        const dimensions = await getImageDimensions(optimizedFile);
        finalWidth = dimensions.width;
        finalHeight = dimensions.height;

        setStatusText("이미지 업로드 중...");
        const uploadedImage = await uploadImage(optimizedFile);
        finalImage = uploadedImage.url;
        finalThumbnail = uploadedImage.thumbnail_url;
  
        // 새 이미지 분석
        setStatusText("이미지 분석 중...");
        const analysisResult = await analyzeImage(finalImage);
        finalEmbedding = analysisResult.embedding;
        finalGeminiDescription = analysisResult.summary;
        finalGeminiTags = Array.isArray(analysisResult.tags) ? analysisResult.tags : [];
      }
  
      setStatusText("저장 중...");
      const payload: Record<string, unknown> = {
        title,
        description,
        image_url: finalImage,
        thumbnail_url: finalThumbnail,
        image_width: finalWidth,
        image_height: finalHeight,
        tags,
        category,
        range,
        gemini_description: finalGeminiDescription,
        gemini_tags: finalGeminiTags,
      };

      if (Array.isArray(finalEmbedding)) {
        payload.embedding = finalEmbedding;
      }

      const res = await fetch(`/api/gallery/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
  
      if (!res.ok) {
        throw new Error(result.error || "수정 실패");
      }
  
      addToast("수정 완료!", "success");
      onSaveSuccess?.();
      onClose?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "저장 중 오류가 발생했습니다.";
      console.error("save 함수 에러:", error);
      addToast(`저장 중 오류: ${message}`, "error");
    } finally {
      setSaving(false);
      setStatusText("");
    }
  };
  if (loading) return <div className="p-6">불러오는 중...</div>;
  if (loadError) {
    return <div className="p-6 text-sm text-gray-500">{loadError}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center modalTitle p-6">
        <h1 className="text-xl font-semibold">갤러리 수정</h1>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-2xl"
        >
          ✕
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
        <input
          className="input-text-36 border p-2 w-full"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="border p-2 w-full textArea"
          placeholder="설명"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        ></textarea>

        <TagInput tags={tags} setTags={setTags} />

        {geminiTags.length > 0 && (
          <div className="p-2 bg-blue-50 rounded text-sm">
            <p className="font-semibold text-blue-900 mb-1">💡 Gemini 분석 태그:</p>
            <div className="flex flex-wrap gap-1">
              {geminiTags.map((tag) => (
                <span
                  key={tag}
                  className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <CategorySelect value={category} setValue={setCategory} />

        <div onClick={() => setRangeOpen(true)} className="border p-2 cursor-pointer">
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

        <div
          className={`
            border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition
            ${isDragging ? "bg-blue-50 border-blue-400" : "border-gray-300"}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("editImageInput")?.click()}
        >
          <input
            id="editImageInput"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setSelectedImage(file);
              e.target.value = "";
            }}
          />

          {previewUrl ? (
            <img
              src={previewUrl}
              className="mx-auto max-h-72 rounded"
              alt="미리보기"
            />
          ) : imageUrl ? (
            <img src={imageUrl} className="mx-auto max-h-72 rounded" alt="현재 이미지" />
          ) : (
            <div className="text-gray-400">
              이미지를 드래그하거나 클릭하여 업로드
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 modalBottom p-6">
        <button
          onClick={save}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={saving}
        >
          {saving ? statusText || "저장 중..." : "저장하기"}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 border rounded hover:bg-gray-100"
        >
          취소
        </button>
      </div>
    </div>
  );
}
