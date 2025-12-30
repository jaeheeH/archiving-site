"use client";

import { useState, useRef } from "react";
import { useToast } from "@/components/ToastProvider";

type ImageUploadProps = {
  label: string;
  currentUrl?: string;
  folder: string; // 'favicon', 'og-image', 'icons' 등
  accept?: string;
  maxSize?: number; // MB 단위
  onUploadComplete: (url: string) => void;
  helpText?: string;
};

export default function ImageUpload({
  label,
  currentUrl,
  folder,
  accept = "image/*",
  maxSize = 5,
  onUploadComplete,
  helpText,
}: ImageUploadProps) {
  const { addToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 확인
    if (file.size > maxSize * 1024 * 1024) {
      addToast(`파일 크기는 ${maxSize}MB 이하여야 합니다.`, "error");
      return;
    }

    try {
      setUploading(true);

      // 미리보기
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // 업로드
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/upload/site-asset", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "업로드 실패");
      }

      const result = await res.json();
      onUploadComplete(result.data.url);
      addToast("이미지 업로드 완료", "success");
    } catch (error: any) {
      console.error("❌ 업로드 에러:", error);
      addToast(error.message || "이미지 업로드 실패", "error");
      setPreview(currentUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onUploadComplete("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold mb-2">{label}</label>

      <div className="flex items-start gap-4">
        {/* 미리보기 */}
        {preview && (
          <div className="relative w-32 h-32 border rounded overflow-hidden bg-gray-50">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain"
            />
            <button
              onClick={handleRemove}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
            >
              ×
            </button>
          </div>
        )}

        {/* 업로드 버튼 */}
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
            id={`upload-${folder}`}
          />
          <label
            htmlFor={`upload-${folder}`}
            className={`inline-block px-4 py-2 border rounded cursor-pointer hover:bg-gray-50 ${
              uploading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {uploading ? "업로드 중..." : preview ? "이미지 변경" : "이미지 선택"}
          </label>
          {helpText && (
            <p className="text-sm text-gray-500 mt-2">{helpText}</p>
          )}
        </div>
      </div>
    </div>
  );
}