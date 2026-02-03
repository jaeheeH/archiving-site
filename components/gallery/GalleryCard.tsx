"use client";
import { useState } from "react";
import Image from "next/image";
import GalleryDetailModal from "./GalleryDetailModal";

type GalleryCardProps = {
  id: number;
  title: string;
  description?: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
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
  imageWidth,
  imageHeight,
  tags,
  onDelete,
  viewMode,
  onEdit,
}: GalleryCardProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [currentId, setCurrentId] = useState(id);

  const imgItemClass = {
    masonry: "masonry",
    grid: "grid",
    list: "list",
  }[viewMode];

  return (
    <>
      <div
        className={`galleryCard group relative rounded-lg overflow-hidden  hover:shadow ${imgItemClass}`}
      >
        {/* 이미지 - Next.js Image 최적화 */}
        <div
          className="imgItem cursor-pointer overflow-hidden"
          onClick={() => {
            setCurrentId(id);
            setShowDetailModal(true);
          }}
        >
          {viewMode === "masonry" ? (
            // Masonry: 원본 비율 유지
            <div className="relative w-full" style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}>
              <Image
                src={imageUrl}
                alt={title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                placeholder="blur"
                blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23f3f4f6' width='16' height='9'/%3E%3C/svg%3E"
              />
            </div>
          ) : viewMode === "grid" ? (
            // Grid: 정사각형 비율
            <div className="relative w-full aspect-square">
              <Image
                src={imageUrl}
                alt={title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                placeholder="blur"
                blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect fill='%23f3f4f6' width='1' height='1'/%3E%3C/svg%3E"
              />
            </div>
          ) : (
            // List: 고정 높이
            <div className="relative w-full h-48">
              <Image
                src={imageUrl}
                alt={title}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                placeholder="blur"
                blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23f3f4f6' width='16' height='9'/%3E%3C/svg%3E"
              />
            </div>
          )}
        </div>

        {/* 정보 */}
        {viewMode === "list" ? (          
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
        ) : "" }
      </div>

      {/* 상세 보기 모달 */}
      {showDetailModal && (
        <GalleryDetailModal
          id={currentId}
          onClose={() => setShowDetailModal(false)}
          onEdit={onEdit}
          onDelete={onDelete}
          onChangeId={setCurrentId}
        />
      )}
    </>
  );
}