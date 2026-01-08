"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
// 경로가 다르다면 실제 경로로 수정해주세요 (이전 코드 기반)
import ClientGalleryDetailModal from "@/components/gallery/ClientGalleryDetailModal"; 

type GalleryItem = {
  id: number;
  title: string;
  description?: string;
  image_url: string;
  image_width?: number;
  image_height?: number;
  tags: string[];
  category?: string;
  range?: string[];
  author?: string;
  gemini_tags?: string[];
  gemini_description?: string;
  created_at?: string;
};

// --- Skeleton Component ---
function HomeGallerySkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse relative overflow-hidden">
          {/* 내부 은은한 빛 효과 */}
          <div className="absolute inset-0 bg-gradient-to-tr from-gray-200 via-gray-100 to-gray-200 opacity-50"></div>
        </div>
      ))}
    </div>
  );
}

export default function HomeGallerySection() {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGalleryId, setSelectedGalleryId] = useState<number | null>(null);

  useEffect(() => {
    const fetchRandomGallery = async () => {
      try {
        setLoading(true);
        // limit을 10개로 설정 (5열 x 2행)
        const res = await fetch("/api/gallery/random?limit=10");

        if (!res.ok) {
          throw new Error("갤러리 조회 실패");
        }

        const data = await res.json();
        setGallery(data.data || []);
      } catch (error) {
        console.error("❌ 갤러리 조회 에러:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRandomGallery();
  }, []);

  const handleCloseModal = () => {
    setSelectedGalleryId(null);
  };

  return (
    <div className="">
        {/* 헤더 섹션 (다른 페이지와 통일감 부여) */}


        {/* 컨텐츠 영역 */}
        {loading ? (
          <HomeGallerySkeleton />
        ) : gallery.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-gray-500">등록된 갤러리가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {gallery.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedGalleryId(item.id)}
                className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
              >
                {/* 이미지 */}
                <Image
                  src={item.image_url}
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  className="object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                  quality={75}
                  placeholder="blur"
                  blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiIC8+PC9zdmc+"
                />

                {/* Hover Overlay (세련된 정보 표시) */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <h3 className="text-white font-medium text-sm line-clamp-1 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    {item.title}
                  </h3>
                  {/* 태그 1~2개만 노출 */}
                  {(item.gemini_tags || item.tags)?.length > 0 && (
                    <div className="flex gap-1 mt-1 translate-y-2 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                      {(item.gemini_tags || item.tags).slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="text-[10px] text-gray-300 bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      <div className="max-w-7xl mx-auto">
      </div>

      {/* 상세 모달 */}
      {selectedGalleryId !== null && (
        <ClientGalleryDetailModal
          id={selectedGalleryId}
          onClose={handleCloseModal}
          onChangeId={setSelectedGalleryId}
        />
      )}
    </div>
  );
}