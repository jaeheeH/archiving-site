"use client";
import { useState } from "react";
import Link from "next/link";
import { Midjourney, FaceBook } from "@/components/BusinessLogo";
import SimilarGalleryModal from "./SimilarGalleryModal";

type GalleryCardProps = {
  id: number;
  title: string;
  description?: string;
  imageUrl: string;
  tags: string[];
  onDelete?: (id: number) => void;
  viewMode: "masonry" | "grid" | "list";
  onEdit: (id: number) => void;
};

export default function GalleryCard({
  id,
  title,
  description,
  imageUrl,
  tags,
  onDelete,
  viewMode,
  onEdit,
}: GalleryCardProps) {
  const [showSimilarModal, setShowSimilarModal] = useState(false);

  const imgClass = {
    masonry: "w-full h-auto object-cover",
    grid: "w-full aspect-square object-cover",
    list: "object-cover ",
  }[viewMode];
  const imgItemClass = {
    masonry: "masonry",
    grid: "grid",
    list: "list",
  }[viewMode];

  return (
    <>
      <div
        className={`galleryCard group relative border rounded-lg overflow-hidden bg-white hover:shadow ${imgItemClass}`}
      >
        {/* 이미지: Pinterest처럼 비율 그대로 */}
        <div className="imgItem">
          <img src={imageUrl} alt={title} className={imgClass} />
        </div>

        {/* 버튼 그룹 */}
        <div className="absolute top-2 left-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
          {/* 수정 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(id);
            }}
            className="bg-blue-600 text-white text-xs px-2 py-1 rounded hover:bg-blue-700"
            title="수정"
          >
            수정
          </button>

          {/* 비슷한 이미지 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSimilarModal(true);
            }}
            className="bg-purple-600 text-white text-xs px-2 py-1 rounded hover:bg-purple-700"
            title="비슷한 이미지"
          >
            🔍 유사
          </button>
        </div>

        {/* 삭제 버튼 */}
        {onDelete && (
          <button
            className="absolute top-2 right-2 text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition bg-black bg-opacity-60 text-white hover:bg-opacity-80"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(id);
            }}
            title="삭제"
          >
            삭제
          </button>
        )}

        <div className="p-4">
          <h2 className="font-medium galleryTitle">{title}</h2>
          {description && (
            <div className="text-sm gallery-description">{description}</div>
          )}
          {tags && tags.length > 0 && (
            <div className="tag-items">
              {tags.map((tag, i) => (
                <span key={i} className="tag">
                  {" "}
                  {tag}{" "}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 유사 이미지 모달 */}
      {showSimilarModal && (
        <SimilarGalleryModal
          galleryId={id}
          title={title}
          onClose={() => setShowSimilarModal(false)}
        />
      )}
    </>
  );
}