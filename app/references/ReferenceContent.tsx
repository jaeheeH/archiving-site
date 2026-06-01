// app/references/ReferenceContent.tsx

'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from "@/components/ToastProvider";
import { createClient } from '@/lib/supabase/client';

// --- Types ---
interface Reference {
  id: number;
  title: string;
  description: string | null;
  url: string;
  image_url: string;
  logo_url: string;
  category: string | null;
  range: string[] | null;
  clicks: number;
}

interface ReferenceContentProps {
  initialReferences: Reference[];
  initialCategories: string[];
  initialScrapedIds?: number[];
}

// --- Main Content Component ---
export default function ReferenceContent({ 
  initialReferences, 
  initialCategories,
  initialScrapedIds = [],
}: ReferenceContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  // State (초기값을 Server에서 받은 데이터로 설정)
  const [references, setReferences] = useState<Reference[]>(initialReferences);
  const categories = useMemo(() => {
    const categorySet = new Set<string>();

    initialCategories.forEach((category) => {
      const name = category.trim();
      if (name) categorySet.add(name);
    });

    initialReferences.forEach((reference) => {
      const category = reference.category?.trim();
      if (category) categorySet.add(category);

      reference.range?.forEach((range) => {
        const name = range.trim();
        if (name) categorySet.add(name);
      });
    });

    return Array.from(categorySet);
  }, [initialCategories, initialReferences]);
  const selectedCategory = searchParams.get('category')?.trim() || 'all';
  const [clickedToday, setClickedToday] = useState<Set<number>>(new Set());
  
  // 🆕 스크랩 관련 상태 - 초기값으로 설정
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [scrapedIds, setScrapedIds] = useState<Set<number>>(
    new Set(initialScrapedIds)
  );
  const [scrappingIds, setScrappingIds] = useState<Set<number>>(new Set());

  // 현재 사용자 조회
  async function fetchCurrentUser() {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user || null;
      setUser(currentUser);

      // 🆕 수정: 초기값이 있으면 API 호출 안 함
      // (로그아웃 후 로그인한 경우만 새로 가져옴)
      const referenceIds = initialReferences.map((reference) => reference.id);

      if (currentUser && initialScrapedIds.length === 0 && referenceIds.length > 0) {
        const { data } = await supabase
          .from('reference_scraps')
          .select('reference_id')
          .eq('user_id', currentUser.id)
          .in('reference_id', referenceIds);

        setScrapedIds(
          new Set((data || []).map((scrap: { reference_id: number }) => scrap.reference_id))
        );
      }
    } catch (error) {
      console.error('❌ 사용자 정보 조회 실패:', error);
    }
  }

  // 클릭 기록 로드
  function loadClickHistory() {
    const today = new Date().toDateString();
    const stored = localStorage.getItem(`reference_clicks_${today}`);
    if (stored) {
      try {
        setClickedToday(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error("로컬 스토리지 파싱 에러", e);
      }
    }
  }

  // Initial Load
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCurrentUser();
    loadClickHistory();
  }, []);

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (category === 'all') {
      params.delete('category');
    } else {
      params.set('category', category);
    }

    const query = params.toString();
    router.push(query ? `/references?${query}` : '/references', { scroll: false });
  };

  // 참고자료 클릭 트래킹
  const handleReferenceClick = async (reference: Reference) => {
    const today = new Date().toDateString();
    const storageKey = `reference_clicks_${today}`;

    const alreadyClicked = clickedToday.has(reference.id);

    if (alreadyClicked) {
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
      const redirectTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      router.push(`/login?redirect=${redirectTo}`);
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
          const redirectTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
          router.push(`/login?redirect=${redirectTo}`);
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

  const filteredReferences = useMemo(() => {
    if (selectedCategory === 'all') return references;

    return references.filter(
      (ref) => ref.category === selectedCategory || ref.range?.includes(selectedCategory)
    );
  }, [references, selectedCategory]);

  const selectedCategoryName = selectedCategory === 'all' ? 'All' : selectedCategory;

  return (
    <div className="archive-page-shell min-h-screen">
      <section className="border-b border-[var(--archive-line)]">
        <div className="mx-auto max-w-[var(--archive-page)] px-4 pb-8 pt-14">
          <p className="archive-eyebrow mb-3 text-[var(--archive-faint)]">Directory</p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">References</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--archive-muted)]">
            디자인, 개발, 마케팅 등 다양한 분야의 영감을 주는 사이트들을 모았습니다. 엄선된 웹사이트 레퍼런스를 탐색해보세요.
          </p>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-b border-[var(--archive-line)] bg-[var(--archive-canvas)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[var(--archive-page)] items-center gap-5 px-4 py-4">

          <nav aria-label="Reference categories" className="flex min-w-0 flex-1 gap-6 overflow-x-auto">
            <button
              onClick={() => handleCategoryChange('all')}
              className={`whitespace-nowrap border-b-2 pb-1 text-[13px] font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'border-[var(--archive-ink)] text-[var(--archive-ink)]'
                  : 'border-transparent text-[var(--archive-muted)] hover:text-[var(--archive-brand)]'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
                className={`whitespace-nowrap border-b-2 pb-1 text-[13px] font-medium transition-colors ${
                  selectedCategory === category
                    ? 'border-[var(--archive-ink)] text-[var(--archive-ink)]'
                    : 'border-transparent text-[var(--archive-muted)] hover:text-[var(--archive-brand)]'
                }`}
              >
                {category}
              </button>
            ))}
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-[var(--archive-page)] px-4 py-10 pb-16">
        <div className="mb-4 flex items-center justify-between text-[12px] text-[var(--archive-muted)]">
          <span className="archive-eyebrow text-[var(--archive-faint)]">
            {selectedCategoryName}
          </span>
          <span className="archive-index">{filteredReferences.length} Items</span>
        </div>

        {/* Content Area */}
        {filteredReferences.length === 0 ? (
          <div className="border-y border-[var(--archive-line)] py-20 text-center">
            <p className="text-[14px] text-[var(--archive-muted)]">등록된 레퍼런스가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                  className="group relative flex h-full flex-col overflow-hidden border border-[var(--archive-line)] bg-[var(--archive-canvas)] transition-all duration-300 hover:border-[var(--archive-brand)]"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-[var(--archive-bg-light)]">
                    {reference.image_url ? (
                      <>
                        <Image
                          src={reference.image_url}
                          alt={reference.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          quality={75}
                          
                        />
                        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/5" />
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <i className="ri-image-2-line text-3xl text-gray-300"></i>
                      </div>
                    )}
                  </div>

                  {/* Content Info */}
                  <div className="flex flex-1 flex-col p-5">
                    
                    {/* Category */}
                    <div className="mb-2">
                      <span className="inline-block text-xs font-bold uppercase tracking-wider text-[var(--archive-brand)]">
                        {reference.range?.[0] || reference.category || 'Reference'}
                      </span>
                    </div>

                    <div className='flex items-start mb-2 justify-between gap-2'>
                      {/* Title */}
                      <h2 className="line-clamp-2 text-xl font-bold leading-snug text-[var(--archive-ink)] transition-colors group-hover:text-[var(--archive-brand)]">
                        {reference.title}
                      </h2>                  
                      {/* 🆕 Scrap Button */}
                      <button
                        onClick={(e) => handleScrapToggle(e, reference.id)}
                        disabled={isScrapping}
                        className={`shrink-0 flex items-center justify-center w-6 h-6 rounded transition ${
                          isScraped
                            ? 'text-[var(--archive-brand)] hover:text-[var(--archive-brand)]'
                            : 'text-gray-400 hover:text-[var(--archive-brand)]'
                        } ${isScrapping ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={isScraped ? '스크랩 취소' : '스크랩'}
                      >
                        <i className={`ri-bookmark-${isScraped ? 'fill' : 'line'} text-lg`}></i>
                      </button>
                    </div>

                    {/* Description */}
                    {reference.description && (
                      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-[var(--archive-muted)]">
                        {reference.description}
                      </p>
                    )}

                    {/* Footer Meta (Domain & Logo) */}
                    <div className="archive-index mt-auto flex items-center gap-2 border-t border-[var(--archive-line)] pt-4 text-xs text-[var(--archive-faint)]">
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
      </section>
    </div>
  );
}
