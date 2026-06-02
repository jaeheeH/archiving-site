'use client';

import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ToastProvider';

// --- Types ---
type GalleryDetail = {
  id: number;
  title: string;
  description?: string;
  image_url: string;
  thumbnail_url?: string | null;
  image_width: number;
  image_height: number;
  tags: string[];
  gemini_tags: string[];
  gemini_description?: string;
  category?: string;
  created_at: string;
  author?: string;
};

type GalleryListItem = {
  id: number;
  title: string;
  image_url: string;
  thumbnail_url?: string | null;
};

type SimilarGalleryItem = {
  id: number;
  title: string;
  image_url: string;
  thumbnail_url?: string | null;
  description?: string | null;
  similarity?: number;
};

type GalleryDetailResponse = {
  data: GalleryDetail;
  prevId: number | null;
  nextId: number | null;
};

interface GalleryDetailClientProps {
  gallery: GalleryDetail;
  prevId: number | null;
  nextId: number | null;
}

export default function GalleryDetailClient({ 
  gallery: initialGallery,
  prevId: initialPrevId,
  nextId: initialNextId,
}: GalleryDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { addToast } = useToast();

  const [gallery, setGallery] = useState<GalleryDetail>(initialGallery);
  const [contentLoading, setContentLoading] = useState(false);

  // 서버에서 전달받은 초기 prev/next ID
  const [serverPrevId, setServerPrevId] = useState<number | null>(initialPrevId);
  const [serverNextId, setServerNextId] = useState<number | null>(initialNextId);

  // 리스트 상태
  const [galleryList, setGalleryList] = useState<GalleryListItem[]>([]);
  
  // 로딩 상태
  const [loadingMoreNext, setLoadingMoreNext] = useState(false);
  const [loadingMorePrev, setLoadingMorePrev] = useState(false);
  const [hasMoreNext, setHasMoreNext] = useState(true);
  const [hasMorePrev, setHasMorePrev] = useState(true);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLButtonElement>(null);
  
  // ✅ 스크롤 보정용 스냅샷
  const snapshotRef = useRef<{ 
    scrollHeight: number; 
    isPrepending: boolean;
    skipScrollIntoView: boolean;
  }>({ 
    scrollHeight: 0, 
    isPrepending: false,
    skipScrollIntoView: false,
  });

  // Actions 상태
  const [isScraped, setIsScraped] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [scrapLoading, setScrapLoading] = useState(false);
  const [similarGallery, setSimilarGallery] = useState<SimilarGalleryItem[]>([]);

  // --------------------------------------------------------------------------
  // 1. 초기 데이터 로드
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (galleryList.some(item => item.id === gallery.id)) return;

    const fetchContextList = async () => {
      const { data: prevData } = await supabase
        .from('gallery')
        .select('id, title, image_url, thumbnail_url')
        .gt('id', gallery.id) 
        .order('id', { ascending: true }) 
        .limit(20);

      const { data: nextData } = await supabase
        .from('gallery')
        .select('id, title, image_url, thumbnail_url')
        .lt('id', gallery.id)
        .order('id', { ascending: false })
        .limit(20);

      const prevItems = prevData ? [...prevData].reverse() : [];
      const nextItems = nextData || [];
      const currentItem: GalleryListItem = { 
        id: gallery.id, 
        title: gallery.title, 
        image_url: gallery.image_url,
        thumbnail_url: gallery.thumbnail_url,
      };

      setGalleryList([...prevItems, currentItem, ...nextItems]);
      
      if (prevItems.length < 20) setHasMorePrev(false);
      if (nextItems.length < 20) setHasMoreNext(false);
    };

    fetchContextList();
  }, [gallery.id, gallery.title, gallery.image_url, gallery.thumbnail_url, galleryList, supabase]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchSimilarGallery() {
      try {
        const response = await fetch(`/api/gallery/${gallery.id}/similar?limit=6`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Similar gallery fetch failed");

        const result = await response.json();
        setSimilarGallery(Array.isArray(result.data) ? result.data : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Failed to load similar gallery:", error);
          setSimilarGallery([]);
        }
      }
    }

    fetchSimilarGallery();

    return () => controller.abort();
  }, [gallery.id]);

  // --------------------------------------------------------------------------
  // 2. 뷰 변경 감지 & 스크롤 센터링 (수정됨)
  // --------------------------------------------------------------------------
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability, react-hooks/set-state-in-effect
    checkScrapStatus(gallery.id);
    
    // ✅ 무한 스크롤 로딩으로 인한 리렌더링 시에는 자동 스크롤(센터링)을 막습니다.
    if (snapshotRef.current.skipScrollIntoView) {
      // 로딩이 완전히 끝났을 때만 플래그를 해제하여, 
      // 데이터 추가 -> DOM 렌더 -> LayoutEffect 보정 순서가 꼬이지 않게 합니다.
      if (!loadingMorePrev && !loadingMoreNext) {
        snapshotRef.current.skipScrollIntoView = false;
      }
      return; 
    }
    
    // 일반적인 뷰 변경(클릭, 네비게이션) 시에만 센터링 실행
    if (!loadingMorePrev && !loadingMoreNext && activeThumbRef.current && scrollRef.current) {
      activeThumbRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [gallery.id, galleryList, loadingMorePrev, loadingMoreNext]);

  // --------------------------------------------------------------------------
  // 3. Popstate
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handlePopState = () => {
      const pathParts = window.location.pathname.split('/');
      const idFromUrl = Number(pathParts[pathParts.length - 1]);
      if (!isNaN(idFromUrl) && idFromUrl !== gallery.id) {
        // eslint-disable-next-line react-hooks/immutability
        changeView(idFromUrl, false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [gallery.id]);

  // --------------------------------------------------------------------------
  // 4. 스크롤 위치 보정 (LayoutEffect)
  // --------------------------------------------------------------------------
  useLayoutEffect(() => {
    
    if (snapshotRef.current.isPrepending && scrollRef.current) {
      const { scrollHeight } = scrollRef.current;
      const { scrollHeight: prevScrollHeight } = snapshotRef.current;
      const heightDiff = scrollHeight - prevScrollHeight;
      
      // 높이 차이만큼 즉시 이동하여 시각적 위치 고정
      if (heightDiff > 0) {
        scrollRef.current.scrollTop += heightDiff;
      }

      // 보정 작업 완료 후 초기화
      snapshotRef.current.isPrepending = false;
      snapshotRef.current.scrollHeight = 0;
    }
  }, [galleryList]);

  // --------------------------------------------------------------------------
  // 5. 무한 스크롤 핸들러
  // --------------------------------------------------------------------------
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;


    if (hasMoreNext && !loadingMoreNext && (scrollHeight - scrollTop - clientHeight < 100)) {
      loadMoreNext();
    }

    if (hasMorePrev && !loadingMorePrev && scrollTop < 50) {
      loadMorePrev();
    }
  };

  const loadMoreNext = async () => {
    if (loadingMoreNext) return;
    
    // next 로드 시에도 센터링 방지
    snapshotRef.current.skipScrollIntoView = true;
    
    setLoadingMoreNext(true);
    
    const lastItem = galleryList[galleryList.length - 1];
    
    const { data } = await supabase
      .from('gallery')
      .select('id, title, image_url, thumbnail_url')
      .lt('id', lastItem.id)
      .order('id', { ascending: false })
      .limit(20);
  
    if (data && data.length > 0) {
      setGalleryList((prev) => {
        const uniqueData = data.filter(d => !prev.some(p => p.id === d.id));
        return [...prev, ...uniqueData];
      });
    } else {
      setHasMoreNext(false);
    }
    setLoadingMoreNext(false);
  };

  const loadMorePrev = async () => {
    if (loadingMorePrev || !scrollRef.current) return;
    
    setLoadingMorePrev(true);
    const firstItem = galleryList[0];

    // 1. 데이터를 먼저 가져옵니다.
    const { data } = await supabase
      .from('gallery')
      .select('id, title, image_url, thumbnail_url')
      .gt('id', firstItem.id)
      .order('id', { ascending: true })
      .limit(20);

    if (data && data.length > 0) {
      // 2. ✅ 상태 업데이트 '직전'에 스냅샷을 저장합니다.
      // (이때가 가장 정확한 현재 스크롤 높이입니다)
      if (scrollRef.current) {
        snapshotRef.current = { 
          scrollHeight: scrollRef.current.scrollHeight, 
          isPrepending: true,
          skipScrollIntoView: true,
        };
      }

      const newItems = [...data].reverse();
      setGalleryList((prev) => {
        const uniqueData = newItems.filter(d => !prev.some(p => p.id === d.id));
        return [...uniqueData, ...prev];
      });
    } else {
      setHasMorePrev(false);
      snapshotRef.current.skipScrollIntoView = false;
    }
    
    setLoadingMorePrev(false);
  };

  // --------------------------------------------------------------------------
  // 6. 뷰 전환 함수
  // --------------------------------------------------------------------------
  const changeView = async (newId: number, updateUrl = true) => {
    if (newId === gallery.id) return;
    try {
      setContentLoading(true);
      const response = await fetch(`/api/gallery/${newId}`);
      if (!response.ok) throw new Error("Fetch error");

      const result = (await response.json()) as GalleryDetailResponse;
      setGallery(result.data);
      setServerPrevId(result.prevId ?? null);
      setServerNextId(result.nextId ?? null);
      
      if (updateUrl) {
        const currentParams = searchParams.toString();
        const queryString = currentParams ? `?${currentParams}` : '';
        window.history.replaceState(null, '', `/gallery/${newId}${queryString}`);
      }
    } catch (error) { 
      console.error(error); 
      addToast("로드 실패", "error"); 
    } finally { 
      setContentLoading(false); 
    }
  };

  const handleClose = () => {
    if (window.history.length > 2) router.back();
    else {
      const currentParams = searchParams.toString();
      const queryString = currentParams ? `?${currentParams}` : '';
      router.push(`/gallery${queryString}`);
    }
  };

  const checkScrapStatus = async (id: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setIsScraped(false); return; }
    const { data } = await supabase.from("gallery_scraps").select("id").eq("gallery_id", id).eq("user_id", user.id).maybeSingle();
    setIsScraped(!!data);
  };

  const handleScrapToggle = async () => {
    if (scrapLoading) return;
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { addToast("로그인 필요", "error"); return; }
    setScrapLoading(true); setIsScraped(!isScraped);
    try {
      const res = await fetch(`/api/gallery/${gallery.id}/scrap`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json(); setIsScraped(data.scraped); addToast(data.scraped ? "저장됨" : "취소됨", "success");
    } catch { setIsScraped(!isScraped); } finally { setScrapLoading(false); }
  };

  const handleCopyPrompt = async () => {
    if (!gallery.description) return;
    await navigator.clipboard.writeText(gallery.description); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!gallery.image_url) return;
    try {
      const response = await fetch(gallery.image_url);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a"); 
      link.href = url; 
      link.download = `${gallery.title.replace(/\s+/g, "_")}.webp`; 
      document.body.appendChild(link); 
      link.click(); 
      document.body.removeChild(link); 
      window.URL.revokeObjectURL(url);
    } catch { addToast("다운로드 실패", "error"); }
  };

  const handleShare = async () => { 
    try { 
      await navigator.clipboard.writeText(window.location.href); 
      addToast("주소 복사됨", "success"); 
    } catch {} 
  };

  // --------------------------------------------------------------------------
  // 7. prev/next 아이템 계산
  // --------------------------------------------------------------------------
  const currentIndex = useMemo(() => galleryList.findIndex((item) => item.id === gallery.id), [galleryList, gallery.id]);
  
  const listPrevItem = galleryList[currentIndex - 1];
  const listNextItem = galleryList[currentIndex + 1];
  
  const prevId = listPrevItem?.id ?? serverPrevId;
  const nextId = listNextItem?.id ?? serverNextId;
  const imageRatioLabel = useMemo(() => {
    const width = gallery.image_width || 0;
    const height = gallery.image_height || 0;

    if (!width || !height) return "-";

    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);

    return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
  }, [gallery.image_height, gallery.image_width]);
  const imageSizeLabel =
    gallery.image_width && gallery.image_height
      ? `${gallery.image_width}w x ${gallery.image_height}h`
      : "-";
  const detailText = gallery.description || gallery.gemini_description || "No prompt available.";
  const visibleTags = useMemo(() => {
    const seen = new Set<string>();

    return [...(gallery.tags || []), ...(gallery.gemini_tags || [])]
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter((tag) => {
        if (!tag) return false;

        const key = tag.toLowerCase();
        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }, [gallery.gemini_tags, gallery.tags]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prevId) changeView(prevId);
      if (e.key === "ArrowRight" && nextId) changeView(nextId);
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevId, nextId]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#1b1b1b] text-gray-100 md:overflow-hidden">
      <button
        onClick={handleClose}
        className="fixed right-6 top-6 z-[60] flex h-9 w-9 items-center justify-center    text-white backdrop-blur transition hover:bg-[#ff4800] md:hidden"
        title="닫기"
      >
        <i className="ri-close-line text-xl"></i>
      </button>
      <div className="flex min-h-full w-full flex-col md:h-full md:flex-row">
        {/* Artwork */}
        <main className="group relative flex min-h-[62vh] flex-1 items-center justify-center bg-[#1f1f1f] p-4 md:min-h-0 md:p-8 position-relative">
          <button
            onClick={handleClose}
            className="hidden h-12 w-12 shrink-0 items-center justify-center  text-gray-400 transition hover:border-[#ff4800] hover:bg-[#ff4800] 
            hover:text-white md:flex top-6 absolute right-6"
            title="닫기"
          >
            <i className="ri-close-line text-2xl"></i>
          </button>
          {contentLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 backdrop-blur-sm">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-white"></div>
            </div>
          )}

          {prevId && (
            <button 
              onClick={() => changeView(prevId)} 
              className="absolute left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white opacity-100 backdrop-blur transition hover:bg-[#ff4800] md:left-8 md:h-12 md:w-12 md:-translate-x-4 md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100"
            >
              <i className="ri-arrow-left-line text-2xl"></i>
            </button>
          )}

          <div className="relative h-[58vh] w-full max-w-6xl md:h-[74vh] md:w-[68vw]">
            <div className="relative h-full w-full">
              <Image 
                src={gallery.image_url} 
                alt={gallery.title} 
                fill 
                className={`object-contain transition-opacity duration-300 ${contentLoading ? 'opacity-50' : 'opacity-100'}`}
                sizes="(max-width: 1200px) 100vw, 70vw" 
                priority 
              />
            </div>
          </div>

          {nextId && (
            <button 
              onClick={() => changeView(nextId)} 
              className="absolute right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white opacity-100 backdrop-blur transition hover:bg-[#ff4800] md:right-8 md:h-12 md:w-12 md:translate-x-4 md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100"
            >
              <i className="ri-arrow-right-line text-2xl"></i>
            </button>
          )}
        </main>

        {/* Detail panel */}
        <aside className="w-full shrink-0 border-t border-white/10 bg-[#111111] md:h-full md:w-[420px] md:border-l md:border-t-0 xl:w-[460px]">
          <div className="flex h-full min-w-0">
          <div className="custom-scrollbar flex h-full min-w-0 flex-1 flex-col overflow-visible md:overflow-y-auto">
            <section className="border-b border-white/10 p-4 md:p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">

                  <h1 className="truncate text-sm font-bold text-white">Image Detail</h1>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleScrapToggle}
                    disabled={scrapLoading}
                    className={`flex h-8 w-8 items-center justify-center rounded-sm transition ${
                      isScraped
                        ? "bg-[#ff4800]/15 text-[#ff4800]"
                        : "text-gray-400 hover:bg-white/10 hover:text-white"
                    }`}
                    title="북마크"
                  >
                    <i className={`${isScraped ? "ri-bookmark-fill" : "ri-bookmark-line"} text-base`}></i>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-gray-400 transition hover:bg-white/10 hover:text-white"
                    title="다운로드"
                  >
                    <i className="ri-download-line text-base"></i>
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-gray-400 transition hover:bg-white/10 hover:text-white"
                    title="공유 링크 복사"
                  >
                    <i className="ri-links-line text-base"></i>
                  </button>
                </div>
              </div>

              <h2 className="mb-3 break-words text-lg font-semibold leading-6 text-white">{gallery.title}</h2>
              <p className="max-w-full whitespace-pre-wrap break-words text-xs leading-5 text-gray-300 [overflow-wrap:anywhere]">
                {detailText}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300">
                  Model&nbsp;&nbsp;{gallery.category || "-"}
                </span>
                <span className="bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300">
                  Ratio&nbsp;&nbsp;{imageRatioLabel}
                </span>
              </div>
            </section>

            <section className="border-b border-white/10 p-4 md:p-5">
              <dl className="space-y-4 text-xs">
                <div className="flex justify-between gap-5">
                  <dt className="text-gray-500">Tool</dt>
                  <dd className="min-w-0 text-right text-gray-300">{gallery.category || "-"}</dd>
                </div>
                <div className="flex justify-between gap-5">
                  <dt className="text-gray-500">Size</dt>
                  <dd className="min-w-0 break-words text-right text-gray-300">{imageSizeLabel}</dd>
                </div>
                <div className="flex justify-between gap-5">
                  <dt className="text-gray-500">Created by</dt>
                  <dd className="min-w-0 break-words text-right text-gray-300">{gallery.author || "ARCH-B"}</dd>
                </div>
                <div className="flex justify-between gap-5">
                  <dt className="text-gray-500">Created on</dt>
                  <dd className="min-w-0 text-right text-gray-300">
                    {new Date(gallery.created_at).toLocaleDateString("ko-KR")}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={handleCopyPrompt}
                  className="flex h-9 items-center justify-center gap-2 bg-white/5 text-xs font-medium text-gray-200 transition hover:bg-white/10"
                >
                  <i className="ri-file-copy-line"></i>
                  {isCopied ? "Copied" : "Copy Prompt"}
                </button>
                <button
                  onClick={handleShare}
                  className="flex h-9 items-center justify-center gap-2 bg-white/5 text-xs font-medium text-gray-200 transition hover:bg-white/10"
                >
                  <i className="ri-links-line"></i>
                  Share
                </button>
              </div>
            </section>

            {visibleTags.length > 0 && (
              <section className="border-b border-white/10 p-4 md:p-5">
                <h3 className="mb-3 text-sm font-bold text-white">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {visibleTags.map((tag) => (
                    <span key={tag.toLowerCase()} className="bg-white/5 px-2.5 py-1 text-xs text-gray-400">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {similarGallery.length > 0 && (
              <section className="border-b border-white/10 p-4 md:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-white">Related Images</h3>
                  <span className="text-[11px] text-gray-500">유사 이미지</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {similarGallery.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => changeView(item.id)}
                      className="group min-w-0 text-left"
                      title={item.title}
                    >
                      <span className="relative block aspect-square overflow-hidden bg-white/5">
                        <Image
                          src={item.thumbnail_url || item.image_url}
                          alt={item.title}
                          fill
                          sizes="140px"
                          className="object-cover opacity-75 transition duration-300 group-hover:scale-105 group-hover:opacity-100"
                        />
                      </span>
                      <span className="mt-2 block truncate text-[11px] font-medium text-gray-400 transition-colors group-hover:text-white">
                        {item.title}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

          </div>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="custom-scrollbar hidden w-20 shrink-0 flex-col gap-2 overflow-y-auto border-l border-white/10 bg-[#171717] p-2 md:flex"
            style={{ overflowAnchor: 'none' }}
          >
            {loadingMorePrev && (
              <div className="flex h-10 w-full shrink-0 items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-white"></div>
              </div>
            )}
            {galleryList.map((item) => (
              <button
                key={item.id}
                type="button"
                ref={item.id === gallery.id ? activeThumbRef : null}
                onClick={() => changeView(item.id)}
                className={`relative aspect-square w-full shrink-0 overflow-hidden border transition ${
                  item.id === gallery.id
                    ? "border-[#ff4800] opacity-100"
                    : "border-transparent opacity-55 hover:opacity-100"
                }`}
              >
                <Image src={item.thumbnail_url || item.image_url} alt={item.title} fill className="object-cover" sizes="96px" />
              </button>
            ))}
            {loadingMoreNext && (
              <div className="flex h-10 w-full shrink-0 items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-white"></div>
              </div>
            )}
          </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
