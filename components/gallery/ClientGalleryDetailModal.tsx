"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import SimilarGalleryModal from "./SimilarGalleryModal";

interface ClientGalleryDetailModalProps {
  id: number;
  onClose: () => void;
  onChangeId?: (id: number) => void;
}

type GalleryDetail = {
  id: number;
  title: string;
  description?: string;
  image_url: string;
  image_width: number;
  image_height: number;
  tags: string[];
  gemini_tags: string[];
  gemini_description?: string;
  category?: string;
  created_at: string;
  author?: string;
};

export default function ClientGalleryDetailModal({
  id,
  onClose,
  onChangeId,
}: ClientGalleryDetailModalProps) {
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  
  // 상태 관리
  const [isScraped, setIsScraped] = useState(false);
  const [scrapLoading, setScrapLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false); // 프롬프트 복사 상태

  const supabase = createClient();
  const { addToast } = useToast();

  useEffect(() => {
    if (id) {
      fetchGalleryDetail();
      checkScrapStatus();
    }
  }, [id]);

  // 모달 열릴 때 백그라운드 스크롤 방지
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // 1. 갤러리 데이터 조회
  const fetchGalleryDetail = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('gallery')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setGallery(data);
    } catch (error) {
      console.error('❌ 갤러리 상세 조회 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  // 2. 스크랩 상태 확인
  const checkScrapStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("gallery_scraps")
      .select("id")
      .eq("gallery_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    setIsScraped(!!data);
  };

  // 3. 스크랩 토글
  const handleScrapToggle = async () => {
    if (scrapLoading) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      addToast("로그인이 필요한 서비스입니다.", "error");
      return;
    }

    setScrapLoading(true);
    const prevScraped = isScraped;
    setIsScraped(!isScraped); // 낙관적 업데이트

    try {
      const res = await fetch(`/api/gallery/${id}/scrap`, { method: "POST" });
      if (!res.ok) throw new Error("API Fail");
      const data = await res.json();
      setIsScraped(data.scraped);
      addToast(data.scraped ? "보관함에 저장되었습니다." : "저장이 취소되었습니다.", "success");
    } catch (error) {
      console.error(error);
      setIsScraped(prevScraped);
      addToast("오류가 발생했습니다.", "error");
    } finally {
      setScrapLoading(false);
    }
  };

  // 4. 프롬프트 복사
  const handleCopyPrompt = async () => {
    if (!gallery?.description) return;
    try {
      await navigator.clipboard.writeText(gallery.description);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      addToast("복사에 실패했습니다.", "error");
    }
  };

  // 5. 공유하기 (Share)
  const handleShare = async () => {
    const url = window.location.href; // 현재 페이지 URL (또는 특정 ID URL 조합 가능)
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: gallery?.title || "Archiving Site",
          text: "Check out this inspiration!",
          url: url,
        });
      } catch (err) {
        console.log("Share canceled", err);
      }
    } else {
      // PC 등 Web Share API 미지원 시 클립보드 복사
      try {
        await navigator.clipboard.writeText(url);
        addToast("링크가 클립보드에 복사되었습니다.", "success");
      } catch (err) {
        addToast("공유하기에 실패했습니다.", "error");
      }
    }
  };

  // 6. 이미지 다운로드 (Download)
  const handleDownload = async () => {
    if (!gallery?.image_url) return;
    
    try {
      const response = await fetch(gallery.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      // 파일명 설정 (제목 or ID)
      link.download = `${gallery.title.replace(/\s+/g, "_")}_${gallery.id}.webp`;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      addToast("이미지 다운로드에 실패했습니다.", "error");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (loading) return null;
  if (!gallery) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 md:p-8"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white w-full max-w-7xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* ✅ [상단 헤더] 좌측: 제목 / 우측: 액션 버튼들 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-20 h-16 shrink-0">
          {/* 좌측: 제목 */}
          <h2 className="text-lg font-bold text-gray-900 truncate pr-4 max-w-[50%] md:max-w-[60%]">
            {gallery.title}
          </h2>

          {/* 우측: 액션 버튼 그룹 */}
          <div className="flex items-center gap-1 md:gap-2">

            {/* 구분선 */}
            <div className="w-[1px] h-6 bg-gray-200 mx-1 md:mx-2"></div>

            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="닫기"
            >
              <i className="ri-close-line text-2xl"></i>
            </button>
          </div>
        </div>

        {/* --- 본문 컨텐츠 (Flex Layout) --- */}
        <div className="flex flex-col md:flex-row h-[calc(100%-64px)] overflow-y-scroll">
          
          {/* 1. 왼쪽 이미지 영역 */}
          <div className="w-full md:w-[60%] bg-gray-50 flex items-center justify-center p-6 md:p-12 relative overflow-hidden border-r border-gray-100 h-[40vh] md:h-full">
            <div 
              className="relative w-full h-full"
            >
              <Image
                src={gallery.image_url}
                alt={gallery.title}
                fill
                sizes="(max-width: 768px) 100vw, 60vw"
                className="object-contain " // 비율 유지하며 전체 보기
                placeholder="blur"
                blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiIC8+PC9zdmc+"
                priority
              />
            </div>
          </div>

          {/* 2. 오른쪽 정보 영역 */}
          <div className="w-full md:w-[40%] bg-white flex flex-col h-full overflow-hidden">
            {/* 스크롤 가능한 상세 정보 */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
              {/* 스크랩 버튼 */}
              <button
                onClick={handleScrapToggle}
                disabled={scrapLoading}
                className={`p-2 rounded-full transition-all ${
                  isScraped 
                    ? "text-blue-600 bg-blue-50 hover:bg-blue-100" 
                    : "text-gray-500 hover:text-black hover:bg-gray-100"
                }`}
                title={isScraped ? "스크랩 취소" : "스크랩"}
              >
                <i className={`text-xl ${isScraped ? "ri-bookmark-fill" : "ri-bookmark-line"}`}></i>
              </button>
              {/* 공유 버튼 */}
              <button
                onClick={handleShare}
                className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
                title="공유하기"
              >
                <i className="ri-share-line text-xl"></i>
              </button>

              {/* 다운로드 버튼 */}
              <button
                onClick={handleDownload}
                className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
                title="이미지 다운로드"
              >
                <i className="ri-download-line text-xl"></i>
              </button>
              {/* 메타 정보 (날짜/카테고리) - 제목은 헤더로 이동했으므로 여기선 제거 */}
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="font-mono">
                  {new Date(gallery.created_at).toLocaleDateString("ko-KR", {
                    year: "numeric", month: "2-digit", day: "2-digit"
                  })}
                </span>
                {gallery.category && (
                  <>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="px-2.5 py-0.5 bg-gray-100 rounded-md text-xs font-medium text-gray-600">
                      {gallery.category}
                    </span>
                  </>
                )}
              </div>

              {/* AI Analysis */}
              {gallery.gemini_description && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <i className="ri-sparkling-fill text-black"></i>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-900">AI Analysis</h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100">
                    {gallery.gemini_description}
                  </p>
                </div>
              )}

              {/* Prompt */}
              {gallery.description && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-900">Prompt</h3>
                    <button
                      onClick={handleCopyPrompt}
                      className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-all ${
                        isCopied 
                          ? 'bg-green-50 text-green-600' 
                          : 'text-gray-500 hover:text-black hover:bg-gray-100'
                      }`}
                    >
                      {isCopied ? (
                        <><i className="ri-check-line text-sm"></i> Copied!</>
                      ) : (
                        <><i className="ri-file-copy-line text-sm"></i> Copy</>
                      )}
                    </button>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 font-mono text-sm text-gray-800 leading-relaxed whitespace-pre-wrap max-h-[240px] overflow-y-auto custom-scrollbar">
                    {gallery.description}
                  </div>
                </div>
              )}

              {/* 태그 목록 */}
              {(gallery.tags?.length > 0 || gallery.gemini_tags?.length > 0) && (
                <div className="pt-2">
                  <div className="flex flex-wrap gap-2">
                    {[...(gallery.tags || []), ...(gallery.gemini_tags || [])].map((tag, idx) => (
                      <Link
                        key={`${tag}-${idx}`}
                        href={`/gallery?tags=${encodeURIComponent(tag)}`}
                        onClick={onClose}
                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-500 rounded-sm text-xs font-medium hover:border-black hover:text-black transition-all"
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 하단 버튼 (유사 이미지 보기만 남김) */}
            <div className="p-6 border-t border-gray-100 bg-white z-10 shrink-0">
              <button
                onClick={() => setShowSimilarModal(true)}
                className="w-full bg-black text-white rounded-xl py-3.5 font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
              >
                <i className="ri-image-line"></i>
                <span>View Similar Styles</span>
              </button>
            </div>
          </div>
        </div>

        {/* 유사 이미지 모달 */}
        {showSimilarModal && gallery && (
          <SimilarGalleryModal
            galleryId={id}
            title={gallery.title}
            onClose={() => setShowSimilarModal(false)}
            onSelectImage={(newId) => {
              if (onChangeId) {
                onChangeId(newId);
                setShowSimilarModal(false);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}