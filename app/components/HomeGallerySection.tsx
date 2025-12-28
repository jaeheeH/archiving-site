"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import GalleryDetailModal from "@/components/gallery/GalleryDetailModal";

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

export default function HomeGallerySection() {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGalleryId, setSelectedGalleryId] = useState<number | null>(null);

  useEffect(() => {
    const fetchRandomGallery = async () => {
      try {
        setLoading(true);
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
    <section className="py-16 px-4">
      <div className="contents mx-auto">
        {/* 제목 */}
        <h2 className="text-4xl font-bold mb-12">갤러리</h2>

        {/* 로딩 상태 */}
        {loading && (
          <div className="text-center text-gray-500 py-16">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400"></div>
            </div>
          </div>
        )}

        {/* 갤러리 없음 */}
        {!loading && gallery.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            갤러리가 없습니다.
          </div>
        )}

        {/* 갤러리 그리드 */}
        {!loading && gallery.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {gallery.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedGalleryId(item.id)}
                className="group cursor-pointer"
              >
                {/* 이미지 컨테이너 */}
                <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4 shadow-md group-hover:shadow-lg transition-shadow duration-300">
                  <Image
                    src={item.image_url}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    quality={75}
                    placeholder="blur"
                    blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23f3f4f6' width='16' height='9'/%3E%3C/svg%3E"
                  />
                </div>

                {/* 텍스트 정보 */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg truncate group-hover:text-blue-600 transition-colors">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-gray-600 text-sm line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  {(item.gemini_tags?.length || 0) > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {item.gemini_tags?.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {selectedGalleryId !== null && selectedGalleryId !== undefined && (
        <GalleryDetailModal
          id={selectedGalleryId}
          onClose={handleCloseModal}
          onChangeId={setSelectedGalleryId}
        />
      )}
    </section>
  );
}