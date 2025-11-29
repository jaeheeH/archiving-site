"use client";
import { useState } from "react";
import GalleryDetailModal from "./GalleryDetailModal";

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
  const [showDetailModal, setShowDetailModal] = useState(false);

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
        <div
          className="imgItem cursor-pointer"
          onClick={() => setShowDetailModal(true)}
        >
          <img src={imageUrl} alt={title} className={imgClass} />
        </div>

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

      {/* 상세 보기 모달 */}
      {showDetailModal && (
        <GalleryDetailModal
          id={id}
          onClose={() => setShowDetailModal(false)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </>
  );
}