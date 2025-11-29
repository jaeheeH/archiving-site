"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";

interface SimilarItem {
  id: number;
  title: string;
  image_url: string;
  similarity: number;
  description : string;
}

interface SimilarGalleryModalProps {
  galleryId: number;
  title: string;
  onClose: () => void;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onSelectImage?: (id: number) => void;
}

export default function SimilarGalleryModal({
  galleryId,
  title,
  onClose,
  onEdit,
  onDelete,
  onSelectImage,
}: SimilarGalleryModalProps) {
  const [loading, setLoading] = useState(true);
  const [similar, setSimilar] = useState<SimilarItem[]>([]);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchSimilar = async () => {
      try {
        setLoading(true);

        const res = await fetch(`/api/gallery/${galleryId}/similar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 8 }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "유사 이미지 검색 실패");
        }

        const data = await res.json();
        setSimilar(data.data || []);

        if (data.data.length === 0) {
          addToast("유사한 이미지가 없습니다.", "info");
        }
      } catch (error: any) {
        console.error("❌ 유사 이미지 검색 에러:", error);
        addToast(error.message, "error");
      } finally {
        setLoading(false);
      }
    };

    fetchSimilar();
  }, [galleryId, addToast]);

  // 스크롤 고정
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">
              "{title}"와 비슷한 이미지
            </h1>

          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">검색 중...</p>
            </div>
          ) : similar.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">유사한 이미지가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {similar.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer"
                  onClick={() => {
                    if (onSelectImage) {
                      onSelectImage(item.id);
                      onClose();
                    }
                  }}
                >
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover hover:scale-105 transition"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm truncate mb-1">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between ">
                      <span className="text-xs text-gray-500">유사도</span>
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {Math.round(item.similarity * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}