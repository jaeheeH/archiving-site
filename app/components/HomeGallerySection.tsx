"use client";

import Image from "next/image";
import Link from "next/link";

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
  return (
    <div className="">
      {initialGallery.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--archive-line)] bg-gray-50 py-20 text-center dark:bg-[#151515]">
          <p className="text-gray-500 dark:text-gray-400">등록된 갤러리가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {initialGallery.map((item) => (
            <Link
              key={item.id}
              href={`/gallery/${item.id}`}
              className="group relative block aspect-square cursor-pointer overflow-hidden rounded-lg bg-gray-100 dark:bg-[#1d1d1d]"
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
                      <span
                        key={idx}
                        className="text-[10px] text-gray-300 bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
