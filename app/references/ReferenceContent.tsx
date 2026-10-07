// app/references/ReferenceContent.tsx

'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from "@/components/ToastProvider";
import { createClient } from '@/lib/supabase/client';
import { SITE_COPY } from '@/lib/site-copy';

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
  const query = (searchParams.get('q') || '').slice(0, 100).trim();
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
    return references.filter(ref =>
      (selectedCategory === 'all' || ref.category === selectedCategory || ref.range?.includes(selectedCategory)) &&
      `${ref.title} ${ref.description || ''} ${ref.category || ''} ${(ref.range || []).join(' ')} ${ref.url}`.toLocaleLowerCase('ko').includes(query.toLocaleLowerCase('ko'))
    );
  }, [references, selectedCategory, query]);

  const selectedCategoryName = selectedCategory === 'all' ? '모든 사이트' : selectedCategory;

  return (
    <main className="archb-archive archive-references-page">
      <header className="archive-heading">
        <span className="archive-kicker">{SITE_COPY.references.eyebrow}</span>
        <h1>{SITE_COPY.references.title}</h1>
        <p>{SITE_COPY.references.description}</p>
      </header>
          <nav aria-label="참고사이트 분야" className="archive-tabs">
            <button
              onClick={() => handleCategoryChange('all')}
              aria-pressed={selectedCategory === 'all'}
            >
              전체
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
                aria-pressed={selectedCategory === category}
              >
                {category}
              </button>
            ))}
          </nav>
        <div className="archive-caption">
          <p>{query ? `“${query}” 검색 결과` : selectedCategoryName} · <strong>{filteredReferences.length}</strong>곳</p>
          {(query || selectedCategory !== 'all') && <Link href="/references">조건 초기화</Link>}
        </div>

        {/* Content Area */}
        {filteredReferences.length === 0 ? (
          <div className="archive-empty">
            <p>
              {query ? '검색 결과가 없습니다. 다른 이름이나 분야로 찾아보세요.' : selectedCategory === 'all' ? SITE_COPY.references.empty : SITE_COPY.references.filteredEmpty}
            </p>
          </div>
        ) : (
          <section aria-label="참고사이트 목록" className="archive-grid">
            {filteredReferences.map((reference) => {
              const isScraped = scrapedIds.has(reference.id);
              const isScrapping = scrappingIds.has(reference.id);

              return (
                <article key={reference.id} className="archive-card archive-reference-card group">
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleReferenceClick(reference)}
                  className="archive-media"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  {/* Thumbnail */}
                    {reference.image_url ? (
                      <>
                        <Image
                          src={reference.image_url}
                          alt=""
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
                </a>

                  {/* Content Info */}
                  <div className="archive-card-copy">
                    
                    {/* Category */}
                    <div>
                      <span className="archive-card-label">
                        {reference.range?.[0] || reference.category || '참고사이트'}
                      </span>
                    </div>

                    <div className="archive-card-title-row">
                      {/* Title */}
                      <h2 className="line-clamp-2">
                        <a href={reference.url} target="_blank" rel="noopener noreferrer" onClick={() => handleReferenceClick(reference)}>{reference.title}<span className="sr-only"> (새 창)</span></a>
                      </h2>                  
                      {/* 🆕 Scrap Button */}
                      <button
                        onClick={(e) => handleScrapToggle(e, reference.id)}
                        disabled={isScrapping}
                        type="button"
                        className="archive-bookmark"
                        aria-label={`${reference.title} ${isScraped ? '스크랩 취소' : '스크랩'}`}
                        aria-pressed={isScraped}
                        title={isScraped ? '스크랩 취소' : '스크랩'}
                      >
                        <i className={`ri-bookmark-${isScraped ? 'fill' : 'line'} text-lg`}></i>
                      </button>
                    </div>

                    {/* Description */}
                    {reference.description && (
                      <p className="archive-card-description line-clamp-2">
                        {reference.description}
                      </p>
                    )}

                    {/* Footer Meta (Domain & Logo) */}
                    <a className="archive-domain" href={reference.url} target="_blank" rel="noopener noreferrer" onClick={() => handleReferenceClick(reference)}>
                      {reference.logo_url ? (
                        <div className="relative w-6 h-6 rounded overflow-hidden">
                          <Image src={reference.logo_url} alt="" fill sizes="24px" className="object-cover" />
                        </div>
                      ) : (
                        <i className="ri-links-line"></i>
                      )}
                      <span className="truncate max-w-[200px]">
                        {reference.url.replace(/^https?:\/\/(www\.)?/, "").split('/')[0]}
                      </span>
                      <i className="ri-external-link-line" aria-hidden="true" /><span className="sr-only"> (새 창)</span>
                    </a>
                  </div>
                </article>
              );
            })}
          </section>
        )}
    </main>
  );
}
