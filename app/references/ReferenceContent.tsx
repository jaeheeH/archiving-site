// app/references/ReferenceContent.tsx

'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from "@/components/ToastProvider";
import { createClient } from '@/lib/supabase/client';

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

interface ReferenceContentProps {
  initialReferences: Reference[];
  initialCategories: string[];
  initialScrapedIds?: number[]; // 🆕 추가
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
export default function ReferenceContent({ 
  initialReferences, 
  initialCategories,
  initialScrapedIds = [], // 🆕 추가
}: ReferenceContentProps) {
  const router = useRouter();
  const { addToast } = useToast();

  // State (초기값을 Server에서 받은 데이터로 설정)
  const [references, setReferences] = useState<Reference[]>(initialReferences);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [clickedToday, setClickedToday] = useState<Set<number>>(new Set());
  
  // 🆕 스크랩 관련 상태 - 초기값으로 설정
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [scrapedIds, setScrapedIds] = useState<Set<number>>(
    new Set(initialScrapedIds)
  );
  const [scrappingIds, setScrappingIds] = useState<Set<number>>(new Set());

  // Initial Load
  useEffect(() => {
    fetchCurrentUser();
    loadClickHistory();
    
    // LocalStorage에서 뷰 모드 불러오기
    const savedView = localStorage.getItem('reference_view_mode');
    if (savedView === 'grid' || savedView === 'list') {
      setViewMode(savedView);
    }
  }, []);

  // 현재 사용자 조회
  const fetchCurrentUser = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // 🆕 수정: 초기값이 있으면 API 호출 안 함
      // (로그아웃 후 로그인한 경우만 새로 가져옴)
      if (user && initialScrapedIds.length === 0) {
        const res = await fetch('/api/references/scraps');
        if (res.ok) {
          const data = await res.json();
          const scrapedReferenceIds = new Set<number>(
            data.data.map((ref: Reference) => ref.id)
          );
          setScrapedIds(scrapedReferenceIds);
        }
      }
    } catch (error) {
      console.error('❌ 사용자 정보 조회 실패:', error);
    }
  };

  // Save View Mode
  useEffect(() => {
    localStorage.setItem('reference_view_mode', viewMode);
  }, [viewMode]);

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

  // 참고자료 클릭 트래킹
  const handleReferenceClick = async (reference: Reference) => {
    const today = new Date().toDateString();
    const storageKey = `reference_clicks_${today}`;
    
    console.log(`🖱️ Clicked ID: ${reference.id}`);
    
    const alreadyClicked = clickedToday.has(reference.id);
    
    if (alreadyClicked) {
      console.log("⚠️ 오늘 이미 클릭한 레퍼런스입니다.");
      return; 
    }

    const newClicked = new Set(clickedToday);
    newClicked.add(reference.id);
    setClickedToday(newClicked);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(newClicked)));

    // Optimistic Update
    setReferences(prev => prev.map(ref => 
      ref.id === reference.id 
        ? { ...ref, clicks: (ref.clicks || 0) + 1 } 
        : ref
    ));

    try {
      await fetch(`/api/references/${reference.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clicks: (reference.clicks || 0) + 1 }),
        keepalive: true,
      });
      console.log("✅ 클릭 카운트 업데이트 완료");
    } catch (error) {
      console.error("❌ 클릭 기록 에러:", error);
    }
  };

  // 🆕 스크랩 토글
  const handleScrapToggle = async (
    e: React.MouseEvent<HTMLButtonElement>,
    referenceId: number
  ) => {
    e.preventDefault(); // 링크 클릭 방지

    // 로그인 확인
    if (!user) {
      addToast('로그인이 필요합니다', 'error');
      router.push(`/auth/login?redirect=${window.location.pathname}`);
      return;
    }

    // 이미 요청 중이면 무시
    if (scrappingIds.has(referenceId)) return;

    try {
      setScrappingIds(prev => new Set([...prev, referenceId]));

      const res = await fetch(`/api/references/${referenceId}/scrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        if (res.status === 401) {
          addToast('로그인이 필요합니다', 'error');
          router.push(`/auth/login?redirect=${window.location.pathname}`);
        } else {
          const error = await res.json();
          addToast(error.error || '스크랩 처리 실패', 'error');
        }
        return;
      }

      const data = await res.json();

      // 상태 업데이트
      if (data.scraped) {
        setScrapedIds(prev => new Set([...prev, referenceId]));
        addToast('✨ 스크랩되었습니다!', 'success');
      } else {
        setScrapedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(referenceId);
          return newSet;
        });
        addToast('스크랩이 취소되었습니다', 'success');
      }
    } catch (error) {
      console.error('❌ 스크랩 처리 에러:', error);
      addToast('스크랩 처리 중 오류가 발생했습니다', 'error');
    } finally {
      setScrappingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(referenceId);
        return newSet;
      });
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
          References
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl leading-relaxed">
          디자인, 개발, 마케팅 등 다양한 분야의 영감을 주는 사이트들을 모았습니다.<br />
          엄선된 웹사이트 레퍼런스를 탐색해보세요.
        </p>
      </div>

      <div className="max-w-7xl mx-auto pb-16 px-4 md:px-0">
        {/* Controls Toolbar */}
        <div className="z-20 bg-white/80 backdrop-blur-md p-4 rounded-xl border border-gray-100 shadow-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
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
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" 
              : "space-y-6"
          }>
            {filteredReferences.map((reference) => {
              const isScraped = scrapedIds.has(reference.id);
              const isScrapping = scrappingIds.has(reference.id);

              return (
                <Link
                  key={reference.id}
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleReferenceClick(reference)}
                  className={`group block bg-white rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100 relative ${
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

                    <div className='flex items-start mb-2 justify-between gap-2'>
                      {/* Title */}
                      <h2 className={`font-bold text-gray-900 leading-snug group-hover:text-blue-600 transition-colors ${
                        viewMode === 'list' ? 'text-2xl' : 'text-xl line-clamp-2'
                      }`}>
                        {reference.title}
                      </h2>                  
                      {/* 🆕 Scrap Button */}
                      {/* <button
                        onClick={(e) => handleScrapToggle(e, reference.id)}
                        disabled={isScrapping}
                        className={`shrink-0 flex items-center justify-center w-6 h-6 rounded transition ${
                          isScraped
                            ? 'text-blue-600 hover:text-blue-700'
                            : 'text-gray-400 hover:text-gray-600'
                        } ${isScrapping ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={isScraped ? '스크랩 취소' : '스크랩'}
                      >
                        <i className={`ri-bookmark-${isScraped ? 'fill' : 'line'} text-lg`}></i>
                      </button> */}
                    </div>

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
                        <div className="relative w-6 h-6 rounded overflow-hidden">
                          <Image src={reference.logo_url} alt={reference.title || "Logo"} fill sizes="64px" className="object-cover" />
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}