"use client";

import { useState } from "react";
import Image from "next/image";
import ClientGalleryDetailModal from "@/components/gallery/ClientGalleryDetailModal"; 

type GalleryItem = {
  id: number;
  title: string;
  description?: string;
  image_url: string;
  tags: string[];
  gemini_tags?: string[];
  // 필요한 필드 추가
};

interface HomeGallerySectionProps {
  initialGallery: GalleryItem[];
}

export default function HomeGallerySection({ initialGallery }: HomeGallerySectionProps) {
  const [selectedGalleryId, setSelectedGalleryId] = useState<number | null>(null);

  const handleCloseModal = () => {
    setSelectedGalleryId(null);
  };

  return (
    <div className="">
      {initialGallery.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-500">등록된 갤러리가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {initialGallery.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedGalleryId(item.id)}
              className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
            >
              <Image
                src={item.image_url}
                alt={item.title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                className="object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                quality={75}
                placeholder="empty" 
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                <h3 className="text-white font-medium text-sm line-clamp-1 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                  {item.title}
                </h3>
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