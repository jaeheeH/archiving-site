'use client';

import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ToastProvider';

// --- Types ---
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

type GalleryListItem = {
  id: number;
  title: string;
  image_url: string;
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
  const activeThumbRef = useRef<HTMLDivElement>(null);
  
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

  // --------------------------------------------------------------------------
  // 1. 초기 데이터 로드
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (galleryList.some(item => item.id === gallery.id)) return;

    const fetchContextList = async () => {
      const { data: prevData } = await supabase
        .from('gallery')
        .select('id, title, image_url')
        .gt('id', gallery.id) 
        .order('id', { ascending: true }) 
        .limit(20);

      const { data: nextData } = await supabase
        .from('gallery')
        .select('id, title, image_url')
        .lt('id', gallery.id)
        .order('id', { ascending: false })
        .limit(20);

      const prevItems = prevData ? [...prevData].reverse() : [];
      const nextItems = nextData || [];
      const currentItem: GalleryListItem = { 
        id: gallery.id, 
        title: gallery.title, 
        image_url: gallery.image_url 
      };

      setGalleryList([...prevItems, currentItem, ...nextItems]);
      
      if (prevItems.length < 20) setHasMorePrev(false);
      if (nextItems.length < 20) setHasMoreNext(false);
    };

    fetchContextList();
  }, [gallery.id, gallery.title, gallery.image_url, galleryList, supabase]);

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
      .select('id, title, image_url')
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
      .select('id, title, image_url')
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
    <div className="fixed inset-0 z-50 flex h-screen w-screen flex-col overflow-hidden bg-white text-gray-950 dark:bg-[#101010] dark:text-gray-100">
      
      {/* Header */}
      <div className="z-20 flex h-16 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6 py-3 dark:border-[#302d28] dark:bg-[#151515]">
        <div className="flex items-center gap-1">
          <button onClick={handleScrapToggle} className={`p-2 rounded-full transition-colors ${isScraped ? "bg-[#ff4800]/10 text-[#ff4800]" : "text-gray-500 hover:bg-[#ff4800]/10 hover:text-[#ff4800] dark:text-gray-400"}`}>
            <i className={`text-xl ${isScraped ? "ri-bookmark-fill" : "ri-bookmark-line"}`}></i>
          </button>
          <button onClick={handleShare} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-[#ff4800]/10 hover:text-[#ff4800] dark:text-gray-400">
            <i className="ri-share-line text-xl"></i>
          </button>
          <button onClick={handleDownload} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-[#ff4800]/10 hover:text-[#ff4800] dark:text-gray-400">
            <i className="ri-download-line text-xl"></i>
          </button>
          <div className="mx-2 h-6 w-[1px] bg-gray-200 dark:bg-[#302d28]"></div>
          <button onClick={handleClose} className="rounded-full p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-500/10">
            <i className="ri-close-line text-2xl"></i>
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex flex-col md:flex-row h-[calc(100%-64px)]">
        
        {/* Left: Image & Navigation */}
        <div className="group relative flex h-full w-full items-center justify-center border-r border-gray-100 bg-gray-50 dark:border-[#302d28] dark:bg-[#101010] md:w-[75%]">
           
          {contentLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm dark:bg-black/50">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-black dark:border-white"></div>
            </div>
          )}

          {prevId && (
            <button 
              onClick={() => changeView(prevId)} 
              className="absolute left-6 z-10 flex h-12 w-12 -translate-x-4 items-center justify-center rounded-full bg-white/90 text-gray-700 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-white hover:text-[#ff4800] group-hover:translate-x-0 group-hover:opacity-100 dark:bg-[#1d1d1d]/90 dark:text-gray-200 dark:hover:bg-[#252525]"
            >
              <i className="ri-arrow-left-line text-2xl"></i>
            </button>
          )}

          <div className="relative w-full h-full p-4 md:p-8 overflow-hidden">
            <div className="relative w-full h-full">
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
              className="absolute right-6 z-10 flex h-12 w-12 translate-x-4 items-center justify-center rounded-full bg-white/90 text-gray-700 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-white hover:text-[#ff4800] group-hover:translate-x-0 group-hover:opacity-100 dark:bg-[#1d1d1d]/90 dark:text-gray-200 dark:hover:bg-[#252525]"
            >
              <i className="ri-arrow-right-line text-2xl"></i>
            </button>
          )}
        </div>

        {/* Right: Info & Vertical Filmstrip */}
        <div className="flex h-full w-full overflow-hidden bg-white dark:bg-[#151515] md:w-[25%]">
          
          {/* Info Area */}
          <div className="custom-scrollbar h-full shrink-0 space-y-6 overflow-y-auto border-b border-gray-100 p-6 dark:border-[#302d28] md:w-[75%]">
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <h2 className="truncate pr-4 text-lg font-bold text-gray-900 dark:text-gray-100">{gallery.title}</h2>
            </div>

            {gallery.description && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-900 dark:text-gray-100">Prompt</h3>
                  <button 
                    onClick={handleCopyPrompt} 
                    className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${isCopied ? 'bg-[#ff4800]/10 text-[#ff4800]' : 'text-gray-500 hover:bg-[#ff4800]/10 hover:text-[#ff4800] dark:text-gray-400'}`}
                  >
                    {isCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="overflow-y-auto text-sm text-gray-500 dark:text-gray-400">{gallery.description}</div>
              </div>
            )}
              
            <ul className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
              <li className="flex justify-between">
                <p>Date</p>
                <p>{new Date(gallery.created_at).toLocaleDateString("ko-KR")}</p>
              </li>
              <li className="flex justify-between">
                <p>Model</p>
                <p>{gallery.category}</p>
              </li>
            </ul>
          </div>

          {/* Vertical Filmstrip */}
          <div className="flex h-full flex-col bg-gray-50 dark:bg-[#101010] md:w-[25%]">
            <div 
              ref={scrollRef} 
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-2 custom-scrollbar relative flex flex-col gap-2"
              style={{ overflowAnchor: 'none' }}
            >
              {/* 위쪽 로딩 스피너 */}
              {loadingMorePrev && (
                <div className="w-full h-10 shrink-0 flex items-center justify-center">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-black dark:border-gray-600 dark:border-t-white"></div>
                </div>
              )}

              {galleryList.map((item) => (
                <div 
                  key={item.id} 
                  ref={item.id === gallery.id ? activeThumbRef : null} 
                  onClick={() => changeView(item.id)} 
                  className={`relative w-full aspect-square shrink-0 rounded-md overflow-hidden cursor-pointer transition-all border-2 ${
                    item.id === gallery.id 
                      ? "border-[#ff4800] ring-2 ring-[#ff4800]/10 z-10" 
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <Image src={item.image_url} alt={item.title} fill className="object-cover" sizes="200px" />
                </div>
              ))}
              
              {/* 아래쪽 로딩 스피너 */}
              {loadingMoreNext && (
                <div className="w-full h-10 shrink-0 flex items-center justify-center">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-black dark:border-gray-600 dark:border-t-white"></div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
