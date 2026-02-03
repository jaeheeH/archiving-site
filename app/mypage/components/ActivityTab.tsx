"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

// 타입 정의
type Reference = {
  id: number;
  title: string;
  description: string | null;
  url: string;
  image_url: string;
  logo_url: string;
  range: string[] | null;
};

type Gallery = {
  id: number;
  title: string;
  image_url: string;
  image_width: number;
  image_height: number;
  tags?: string[];
  description?: string;
  created_at: string;
};

export default function ActivityTab() {
  const supabase = createClient();
  const { addToast } = useToast(); // 구조분해 할당 수정

  const [activeTab, setActiveTab] = useState<"gallery" | "reference">("gallery");
  const [loading, setLoading] = useState(true);
  
  // 데이터 상태
  const [references, setReferences] = useState<Reference[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  
  // 로딩 중복 방지
  const [scrappingIds, setScrappingIds] = useState<Set<number>>(new Set());

  // 초기 마운트 시 모든 데이터 로드
  useEffect(() => {
    fetchAllScraps();
  }, []);

  const fetchAllScraps = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 갤러리 스크랩 가져오기
      const { data: galleryScraps } = await supabase
        .from("gallery_scraps")
        .select("gallery_id")
        .eq("user_id", user.id);

      if (galleryScraps && galleryScraps.length > 0) {
        const ids = galleryScraps.map((s) => s.gallery_id);
        const { data: gals } = await supabase
          .from("gallery")
          .select("*")
          .in("id", ids)
          .order("id", { ascending: false });
        setGalleries(gals || []);
      }

      // 레퍼런스 스크랩 가져오기
      const { data: referenceScraps } = await supabase
        .from("reference_scraps")
        .select("reference_id")
        .eq("user_id", user.id);

      if (referenceScraps && referenceScraps.length > 0) {
        const ids = referenceScraps.map((s) => s.reference_id);
        const { data: refs } = await supabase
          .from("references")
          .select("*")
          .in("id", ids)
          .order("id", { ascending: false });
        setReferences(refs || []);
      }
    } catch (error) {
      console.error("스크랩 로딩 실패:", error);
      addToast("스크랩을 불러오는데 실패했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  // 스크랩 취소 (공통)
  const handleUnscrap = async (e: React.MouseEvent, id: number, type: "gallery" | "reference") => {
    // 링크 이동 방지 및 이벤트 전파 중단
    e.stopPropagation();
    e.preventDefault();

    if (scrappingIds.has(id)) return;

    try {
      setScrappingIds((prev) => new Set([...prev, id]));
      const endpoint = type === "gallery" ? `/api/gallery/${id}/scrap` : `/api/references/${id}/scrap`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("API Error");
      const data = await res.json();

      if (!data.scraped) {
        addToast("저장이 취소되었습니다.", "success");
        // 목록에서 즉시 제거 (낙관적 업데이트)
        if (type === "gallery") {
          setGalleries((prev) => prev.filter((g) => g.id !== id));
        } else {
          setReferences((prev) => prev.filter((r) => r.id !== id));
        }
      }
    } catch (error) {
      console.error(error);
      addToast("오류가 발생했습니다.", "error");
    } finally {
      setScrappingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="max-w-5xl w-full">
      {/* 탭 헤더 */}
      <div className="flex items-center gap-6 mb-8 border-b border-gray-100">
        <button
          onClick={() => setActiveTab("gallery")}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === "gallery" 
              ? "text-black after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-black" 
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Gallery <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{galleries.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("reference")}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === "reference" 
              ? "text-black after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-black" 
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          References <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{references.length}</span>
        </button>
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-[4/3] bg-gray-100 rounded-xl"></div>
          ))}
        </div>
      )}

      {/* 컨텐츠 영역 */}
      {!loading && (
        <>
          {/* --- 갤러리 탭 --- */}
          {activeTab === "gallery" && (
            galleries.length === 0 ? (
              <EmptyState type="gallery" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {galleries.map((item) => (
                  // ✅ [수정] div -> Link로 변경하여 상세 페이지로 이동
                  <Link 
                    key={item.id}
                    href={`/gallery/${item.id}`} // 상세 페이지 경로
                    className="group relative bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all"
                  >
                    <div className="aspect-[4/3] relative bg-gray-100 overflow-hidden">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <i className="ri-image-line text-2xl"></i>
                        </div>
                      )}
                      
                      {/* 스크랩 취소 버튼 (Link 내부이므로 e.preventDefault 필수) */}
                      <button
                        onClick={(e) => handleUnscrap(e, item.id, "gallery")}
                        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-white/90 rounded-full shadow-sm text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-red-500"
                        title="스크랩 취소"
                      >
                        <i className="ri-bookmark-fill"></i>
                      </button>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 truncate text-sm">{item.title}</h3>
                      <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.tags?.slice(0, 3).map((tag, idx) => (
                          <span key={idx} className="text-[10px] bg-gray-50 border border-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {/* --- 레퍼런스 탭 --- */}
          {activeTab === "reference" && (
            references.length === 0 ? (
              <EmptyState type="reference" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {references.map((item) => (
                  <Link
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    className="group block bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all hover:-translate-y-1"
                  >
                    <div className="aspect-video relative bg-gray-100">
                      {item.image_url && (
                        <Image
                          src={item.image_url}
                          alt={item.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      )}
                      <div className="absolute top-3 left-3">
                          <span className="bg-black/60 backdrop-blur text-white text-[10px] px-2 py-1 rounded font-medium uppercase">
                            {item.range?.[0] || 'REF'}
                          </span>
                      </div>
                      <button
                        onClick={(e) => handleUnscrap(e, item.id, "reference")}
                        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-white/90 rounded-full shadow-sm text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-red-500"
                      >
                        <i className="ri-bookmark-fill"></i>
                      </button>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 line-clamp-1 mb-1 text-sm">{item.title}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2 h-8">{item.description}</p>
                      <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-gray-400">
                        {item.logo_url ? (
                          <Image src={item.logo_url} width={16} height={16} alt="icon" className="rounded-sm" />
                        ) : (
                          <i className="ri-link"></i>
                        )}
                        <span className="truncate">{item.url.replace(/^https?:\/\//, '').split('/')[0]}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

// 빈 상태 컴포넌트
function EmptyState({ type }: { type: "gallery" | "reference" }) {
  const isGallery = type === "gallery";
  return (
    <div className="py-20 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
      <div className="mb-4 text-4xl text-gray-300">
        <i className={isGallery ? "ri-image-line" : "ri-article-line"}></i>
      </div>
      <p className="text-gray-500 mb-6">
        {isGallery ? "보관한 갤러리가 없습니다." : "보관한 레퍼런스가 없습니다."}
      </p>
      <Link 
        href={isGallery ? "/gallery" : "/references"}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
      >
        <span>{isGallery ? "갤러리 탐색하기" : "레퍼런스 탐색하기"}</span>
        <i className="ri-arrow-right-line"></i>
      </Link>
    </div>
  );
}