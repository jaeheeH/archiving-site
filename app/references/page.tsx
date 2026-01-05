'use client';

import { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from "@/components/ToastProvider";

// --- Types ---
interface Category {
  id: number;
  name: string;
}

interface Reference {
  id: number;
  title: string;
  description: string | null;
  url: string;
  image_url: string;
  logo_url: string;
  range: string[] | null;
  clicks: number;
  created_at: string;
}

// --- Skeleton Component ---
function ReferenceSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  const items = Array.from({ length: 6 });

  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        {items.map((_, i) => (
          <div key={i} className="flex flex-col md:flex-row gap-6 border-b border-gray-100 pb-6 last:border-0 animate-pulse">
            <div className="w-full md:w-72 h-48 bg-gray-200 rounded-lg shrink-0"></div>
            <div className="flex-1 space-y-3 py-2">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-32 mt-auto"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Grid Skeleton
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
      {items.map((_, i) => (
        <div key={i} className="flex flex-col h-full animate-pulse">
          <div className="w-full aspect-video bg-gray-200 rounded-lg mb-4"></div>
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main Content Component ---
function ReferenceContent() {
  const { addToast } = useToast();

  // State
  const [references, setReferences] = useState<Reference[]>([]);
  const [categories, setCategories] = useState<string[]>([]); // API 응답 구조에 따라 string[]
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [clickedToday, setClickedToday] = useState<Set<number>>(new Set());

  // Initial Load
  useEffect(() => {
    loadData();
    loadClickHistory();
    
    // LocalStorage에서 뷰 모드 불러오기
    const savedView = localStorage.getItem('reference_view_mode');
    if (savedView === 'grid' || savedView === 'list') {
      setViewMode(savedView);
    }
  }, []);

  // Save View Mode
  useEffect(() => {
    localStorage.setItem('reference_view_mode', viewMode);
  }, [viewMode]);

  // 데이터 로드
  const loadData = async () => {
    try {
      setLoading(true);

      const [catRes, refRes] = await Promise.all([
        fetch("/api/references-categories"),
        fetch("/api/references?limit=100"),
      ]);

      if (catRes.ok) {
        const { data } = await catRes.json();
        const categoryNames = data.map((cat: any) => cat.name);
        setCategories(categoryNames);
      }

      if (refRes.ok) {
        const { data } = await refRes.json();
        setReferences(data || []);
      }
    } catch (error) {
      console.error("❌ 데이터 로드 에러:", error);
      addToast({
        type: "error",
        message: "데이터를 불러오는 중 오류가 발생했습니다.",
      });
    } finally {
      setLoading(false);
    }
  };

  // 클릭 기록 로드
  const loadClickHistory = () => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem(`reference_clicks_${today}`);
    if (stored) {
      try {
        setClickedToday(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error("로컬 스토리지 파싱 에러", e);
      }
    }
  };

// 클릭 트래킹 함수 수정
const handleReferenceClick = async (reference: Reference) => {
  const today = new Date().toDateString();
  const storageKey = `reference_clicks_${today}`;
  
  // 디버깅용 로그: 현재 클릭 상태 확인
  console.log(`🖱️ Clicked ID: ${reference.id}`);
  
  // 이미 클릭했는지 확인
  const alreadyClicked = clickedToday.has(reference.id);
  
  if (alreadyClicked) {
    console.log("⚠️ 오늘 이미 클릭한 레퍼런스입니다. (API 요청 생략)");
    return; 
  }

  if (!alreadyClicked) {
    // 1. 로컬 스토리지 저장 (기존 코드)
    const newClicked = new Set(clickedToday);
    newClicked.add(reference.id);
    setClickedToday(newClicked);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(newClicked)));

    // ✨ [추가] 화면의 숫자 즉시 +1 업데이트 (Optimistic Update)
    setReferences(prev => prev.map(ref => 
      ref.id === reference.id 
        ? { ...ref, clicks: (ref.clicks || 0) + 1 } 
        : ref
    ));

    // 2. API 요청 (기존 코드 + 응답 확인 추가)
    try {
      const res = await fetch(`/api/references/${reference.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clicks: reference.clicks + 1 }),
        keepalive: true,
      });

      // ✨ [추가] 서버가 진짜 성공했는지 확인
      if (!res.ok) {
         console.error("❌ 서버 에러 발생:", res.status);
         // 실패했다면 다시 숫자를 되돌리거나 에러 처리
      } else {
         console.log("✅ DB 업데이트 성공 확인");
      }
    } catch (error) {
      console.error("❌ 네트워크 에러:", error);
    }
  }

  // 1. 로컬 스토리지 및 상태 즉시 업데이트 (UI 반응성)
  const newClicked = new Set(clickedToday);
  newClicked.add(reference.id);
  setClickedToday(newClicked);
  localStorage.setItem(storageKey, JSON.stringify(Array.from(newClicked)));

  // 2. API 요청 전송
  try {
    // keepalive: true 옵션이 핵심입니다.
    // 페이지가 닫히거나 이동해도 요청을 끝까지 보냅니다.
    await fetch(`/api/references/${reference.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        // 안전장치: reference.clicks가 혹시 null/undefined면 0으로 처리
        clicks: (reference.clicks || 0) + 1 
      }),
      keepalive: true, 
    });
    console.log("✅ 클릭 카운트 업데이트 요청 전송 완료");
    
  } catch (error) {
    console.error("❌ 클릭 기록 에러:", error);
    // 에러 시 로컬 스토리지 롤백 로직이 필요하다면 여기에 추가
  }
};

  // 필터링
  const filteredReferences = selectedCategory === 'all'
    ? references
    : references.filter((ref) => ref.range?.includes(selectedCategory));

  return (
    <div className="min-h-screen py-12">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-10 px-4 md:px-0">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4 font-sans uppercase">
          References<br />
          <span className="text-gray-400 font-light">Curated Web & Design</span>
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl leading-relaxed">
          디자인, 개발, 마케팅 등 다양한 분야의 영감을 주는 사이트들을 모았습니다.<br />
          엄선된 웹사이트 레퍼런스를 탐색해보세요.
        </p>
      </div>

      <div className="max-w-7xl mx-auto pb-16 px-4 md:px-0">
        {/* Controls Toolbar */}
        <div className="sticky top-4 z-20 bg-white/80 backdrop-blur-md p-4 rounded-xl border border-gray-100 shadow-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-md text-sm transition-all border whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-md text-sm transition-all border whitespace-nowrap ${
                  selectedCategory === category
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Right Side: View Toggle & Count */}
          <div className="flex items-center gap-4 ml-auto md:ml-0 w-full md:w-auto justify-end">
            <span className="text-xs text-gray-400 font-mono hidden md:inline-block">
              {filteredReferences.length} Items
            </span>
            
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-sm transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                aria-label="Grid view"
              >
                <i className="ri-layout-grid-line text-lg"></i>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md text-sm transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                aria-label="List view"
              >
                <i className="ri-list-check text-lg"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <ReferenceSkeleton viewMode={viewMode} />
        ) : filteredReferences.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-20 text-center border border-dashed border-gray-200">
            <p className="text-gray-500">등록된 레퍼런스가 없습니다.</p>
          </div>
        ) : (
          <div className={
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8" 
              : "space-y-6"
          }>
            {filteredReferences.map((reference) => (
              <Link
                key={reference.id}
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleReferenceClick(reference)}
                className={`group block bg-white rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100 ${
                  viewMode === 'list' ? 'flex flex-col md:flex-row gap-6 p-4 border-gray-50 hover:bg-gray-50/50' : 'flex flex-col h-full'
                }`}
              >
                {/* Thumbnail */}
                <div className={`relative bg-gray-100 overflow-hidden shrink-0 ${
                  viewMode === 'list' 
                    ? 'w-full md:w-72 aspect-video md:aspect-[4/3] rounded-lg' 
                    : 'w-full aspect-video'
                }`}>
                  {reference.image_url ? (
                    <>
                      <Image
                        src={reference.image_url}
                        alt={reference.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        sizes={viewMode === 'list' ? "300px" : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
                        quality={75}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <i className="ri-image-2-line text-3xl text-gray-300"></i>
                    </div>
                  )}
                </div>

                {/* Content Info */}
                <div className={`flex flex-col ${viewMode === 'list' ? 'flex-1 py-2' : 'flex-1 p-5'}`}>
                  
                  {/* Category */}
                  <div className="mb-2">
                    <span className="inline-block text-xs font-bold tracking-wider uppercase text-blue-600">
                      {reference.range?.[0] || 'Reference'}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className={`font-bold text-gray-900 mb-2 leading-snug group-hover:text-blue-600 transition-colors ${
                    viewMode === 'list' ? 'text-2xl' : 'text-xl line-clamp-2'
                  }`}>
                    {reference.title}
                  </h2>

                  {/* Description */}
                  {reference.description && (
                    <p className={`text-gray-500 text-sm mb-4 leading-relaxed ${
                      viewMode === 'list' ? 'line-clamp-3' : 'line-clamp-2'
                    }`}>
                      {reference.description}
                    </p>
                  )}

                  {/* Footer Meta (Domain & Logo) */}
                  <div className={`mt-auto flex items-center gap-2 text-xs text-gray-400 font-mono ${
                    viewMode === 'list' ? '' : 'pt-4 border-t border-gray-100'
                  }`}>
                    {reference.logo_url ? (
                      <div className="relative w-4 h-4 rounded overflow-hidden">
                        <Image src={reference.logo_url} alt="" fill className="object-cover" />
                      </div>
                    ) : (
                      <i className="ri-links-line"></i>
                    )}
                    <span className="truncate max-w-[200px]">
                      {reference.url.replace(/^https?:\/\/(www\.)?/, "").split('/')[0]}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReferencesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ReferenceContent />
    </Suspense>
  );
}