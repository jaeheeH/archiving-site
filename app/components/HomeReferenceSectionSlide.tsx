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
  category?: string | null;
  range?: string[] | null;
  clicks: number;
};

interface HomeReferenceProps {
  initialReferences: Reference[];
}

export default function HomeReferenceSectionSlide({ initialReferences }: HomeReferenceProps) {
  
  const handleClick = async (item: Reference) => {
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
        <div className="border-y border-[var(--archive-line)] py-16 text-center text-[var(--archive-muted)]">
          선별한 레퍼런스를 준비하고 있습니다.
        </div>
      ) : (
        <Swiper
          modules={[Pagination]}
          spaceBetween={28}
          slidesPerView={1.12}
          pagination={{ clickable: true, type: "progressbar" }}
          breakpoints={{
            768: { slidesPerView: 2.15 },
            1024: { slidesPerView: 3 },
          }}
          className="referenceSwiper"
        >
          {initialReferences.map((item) => (
            <SwiperSlide key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleClick(item)}
                className="group block w-full text-left cursor-pointer"
              >
                <article className="h-full">
                  <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-[14px] bg-[#ecece8]">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 20vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                        quality={75}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[var(--archive-faint)]">
                        <i className="ri-image-2-line text-3xl"></i>
                      </div>
                    )}
                  </div>

                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#888883]">
                    {item.range?.[0] || item.category || "Reference"}
                  </p>

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
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--archive-bg-regular)]">
                        <i className="ri-global-line text-[10px] text-gray-400"></i>
                      </div>
                    )}
                    <h3 className="line-clamp-1 text-[17px] font-semibold tracking-[-0.02em] text-[var(--archive-ink)] group-hover:underline">
                      {item.title}
                    </h3>
                  </div>

                  {item.description && (
                    <p className="line-clamp-2 text-sm leading-6 text-[var(--archive-muted)]">
                      {item.description}
                    </p>
                  )}
                </article>
              </a>
            </SwiperSlide>
          ))}
        </Swiper>
      )}

      <style jsx global>{`
        .referenceSwiper {
          padding-bottom: 34px;
        }
        .referenceSwiper .swiper-pagination-progressbar {
          bottom: 0;
          top: auto;
          height: 2px;
          background: var(--archive-line);
        }
        .referenceSwiper .swiper-pagination-progressbar-fill {
          background: var(--archive-ink);
        }
      `}</style>
    </div>
  );
}
