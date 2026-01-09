"use client";

import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";

type Reference = {
  id: number;
  title: string;
  description?: string;
  url: string;
  image_url: string;
  logo_url?: string;
  clicks: number;
  created_at: string;
};

interface HomeReferenceProps {
  initialReferences: Reference[];
}

export default function HomeReferenceSectionSlide({ initialReferences }: HomeReferenceProps) {
  
  const handleClick = async (item: Reference) => {
    window.open(item.url, "_blank", "noopener,noreferrer");
    
    // 조회수 API 호출은 클라이언트 사이드에서 유지 (Fire and forget)
    try {
      fetch(`/api/references/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clicks: item.clicks + 1 }),
      });
    } catch (error) {
      console.error("조회수 업데이트 실패:", error);
    }
  };

  return (
    <div className="homeReferenceSection">
      {initialReferences.length === 0 ? (
        <div className="text-center text-gray-500 py-16 bg-gray-50 rounded-lg">
          레퍼런스가 없습니다.
        </div>
      ) : (
        <Swiper
          modules={[Pagination]}
          spaceBetween={24}
          slidesPerView={1.2}
          pagination={{ clickable: true, type: "progressbar" }}
          breakpoints={{
            768: { slidesPerView: 3.2 },
          }}
          className="referenceSwiper"
        >
          {initialReferences.map((item) => (
            <SwiperSlide key={item.id}>
              <button
                onClick={() => handleClick(item)}
                className="group block w-full text-left cursor-pointer"
              >
                <article className="h-full">
                  <div className="relative aspect-video overflow-hidden bg-gray-100 mb-4">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 20vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        quality={75}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <i className="ri-image-2-line text-3xl"></i>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    {item.logo_url ? (
                      <div className="relative w-5 h-5 shrink-0">
                        <Image
                          src={item.logo_url}
                          alt="logo"
                          fill
                          sizes="20px"
                          className="object-contain rounded-full"
                        />
                      </div>
                    ) : (
                      <div className="w-5 h-5 bg-gray-200 rounded-full shrink-0 flex items-center justify-center">
                        <i className="ri-global-line text-[10px] text-gray-400"></i>
                      </div>
                    )}
                    <h3 className="font-semibold text-sm line-clamp-1 transition-colors">
                      {item.title}
                    </h3>
                  </div>

                  {item.description && (
                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </article>
              </button>
            </SwiperSlide>
          ))}
        </Swiper>
      )}

      <style jsx global>{`
        .referenceSwiper {
          padding-bottom: 32px;
        }
        .referenceSwiper .swiper-pagination-progressbar {
          bottom: 0;
          top: auto;
          height: 2px;
          background: #666;
        }
        .referenceSwiper .swiper-pagination-progressbar-fill {
          background: #fff;
        }
      `}</style>
    </div>
  );
}