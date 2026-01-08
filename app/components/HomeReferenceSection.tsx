"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

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

// --- Skeleton Component ---
function ReferenceSkeleton() {
  const items = Array.from({ length: 5 });

  return (
    <div className="grid grid-cols-5 gap-4">
      {items.map((_, i) => (
        <div key={i} className="animate-pulse">
          {/* 이미지 영역 */}
          <div className="aspect-video bg-gray-200 rounded-lg mb-3"></div>
          
          {/* 로고 + 제목 영역 */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-gray-200 rounded-full shrink-0"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
          
          {/* 설명 영역 */}
          <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          
        </div>
      ))}
    </div>
  );
}

export default function HomeReferenceSection() {
  const [references, setReferences] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const res = await fetch("/api/references?page=1&limit=5");

      if (res.ok) {
        const data = await res.json();
        setReferences(data.data || []);
      }
    } catch (error) {
      console.error("❌ 레퍼런스 로드 에러:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg:col-span-3">
      {/* 로딩 상태에 따라 스켈레톤 또는 그리드 렌더링 */}
      {loading ? (
        <ReferenceSkeleton />
      ) : references.length === 0 ? (
        <div className="text-center text-gray-500 py-16 bg-gray-50 rounded-lg">
          레퍼런스가 없습니다.
        </div>
      ) : (
        <div className="mainHomeReference">
          <div className="grid grid-cols-5 gap-4">
            {references.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <article className="h-full">
                  {/* 이미지 */}
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-100 mb-3">
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

                  {/* 로고 + 제목 */}
                  <div className="flex items-center gap-2 mb-2">
                    {item.logo_url ? (
                      <div className="relative w-6 h-6 shrink-0">
                        <Image
                          src={item.logo_url}
                          alt={`${item.title} logo`}
                          fill
                          sizes="24px"
                          className="object-contain rounded-full"
                        />
                      </div>
                    ) : (
                      <div className="w-6 h-6 bg-gray-200 rounded-full shrink-0 flex items-center justify-center">
                        <i className="ri-global-line text-xs text-gray-400"></i>
                      </div>
                    )}
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-1 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                  </div>

                  {/* 설명 */}
                  {item.description && (
                    <p className="text-gray-600 text-xs line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </article>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}