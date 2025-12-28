"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import SimilarGalleryModal from "./SimilarGalleryModal";

interface GalleryDetailModalProps {
  id: number;
  onClose: () => void;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onDeleted?: () => void;
  onChangeId?: (id: number) => void;
}

type GalleryDetail = {
  id: number;
  title: string;
  description?: string;
  image_url: string;
  image_width: number;
  image_height: number;
  tags: string[];
  gemini_tags: string[];
  gemini_description?: string;
  category?: string;
  created_at: string;
  author?: string;
};

export default function GalleryDetailModal({
  id,
  onClose,
  onEdit,
  onDelete,
  onDeleted,
  onChangeId,
}: GalleryDetailModalProps) {
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  const supabase = createClient();

  const handleEdit = () => {
    onEdit?.(id);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    if (onDelete) {
      onDelete(id);
      onClose();
      onDeleted?.();
    }
  };

  useEffect(() => {
    fetchGalleryDetail();
  }, [id]);

  // 스크롤 고정
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const fetchGalleryDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/gallery/${id}`);
  
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "갤러리 조회 실패");
      }
  
      const { data: galleryData } = await res.json();
      console.log("📥 갤러리 데이터:", galleryData);  // 디버깅용
      setGallery(galleryData);
    } catch (error) {
      console.error("갤러리 상세 조회 에러:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p>불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!gallery) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-contents"
        onClick={handleBackdropClick}
      >
        <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          {/* 헤더 */}
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">{gallery.title}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>

          {/* 본문 */}
          <div className="p-6 modal-contents-detail">
            <div className="grid md:grid-cols-2 gap-6">
              {/* 이미지 - Next.js Image 최적화 */}
              <div className="relative">
                <div className="relative w-full" style={{ aspectRatio: `${gallery.image_width} / ${gallery.image_height}` }}>
                  <Image
                    src={gallery.image_url}
                    alt={gallery.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain rounded-lg"
                    placeholder="blur"
                    blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23f3f4f6' width='16' height='9'/%3E%3C/svg%3E"
                    priority
                  />
                </div>
              </div>

              {/* 정보 */}
              <div className="space-y-4">
                {/* 제목 */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">
                    제목
                  </h3>
                  <p className="text-base">{gallery.title}</p>
                </div>

                {/* 설명 */}
                {gallery.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">
                      설명
                    </h3>
                    <p className="text-base text-gray-700">
                      {gallery.description}
                    </p>
                  </div>
                )}

                {/* AI 분석 */}
                {gallery.gemini_description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">
                      AI 분석
                    </h3>
                    <p className="text-base text-gray-700">
                      {gallery.gemini_description}
                    </p>
                  </div>
                )}

                {/* 카테고리 */}
                {gallery.category && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">
                      카테고리
                    </h3>
                    <span className="inline-block px-3 py-1 bg-gray-100 rounded-full text-sm">
                      {gallery.category}
                    </span>
                  </div>
                )}

                {/* 태그 */}
                {(gallery.gemini_tags?.length > 0 || gallery.tags?.length > 0) && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">
                      태그
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(gallery.gemini_tags || gallery.tags).map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 생성일 */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">
                    생성일
                  </h3>
                  <p className="text-base text-gray-700">
                    {new Date(gallery.created_at).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* 액션 버튼 */}
                <div className="pt-4 border-t space-y-2">
                  <button
                    onClick={() => setShowSimilarModal(true)}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <i className="ri-image-line mr-2"></i>
                    유사 이미지 보기
                  </button>

                  {onEdit && (
                    <button
                      onClick={handleEdit}
                      className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <i className="ri-edit-line mr-2"></i>
                      수정
                    </button>
                  )}

                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <i className="ri-delete-bin-line mr-2"></i>
                      삭제
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 유사 이미지 모달 */}
      {showSimilarModal && gallery && (
        <SimilarGalleryModal
          galleryId={id}
          title={gallery.title}
          onClose={() => setShowSimilarModal(false)}
          onEdit={onEdit}
          onDelete={onDelete}
          onSelectImage={(newId) => {
            if (onChangeId) {
              onChangeId(newId);
              setShowSimilarModal(false);
            }
          }}
        />
      )}
    </>
  );
}