'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Image from '@/app/components/ArchiveImage';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import ActiveFilter from "@/components/gallery/ActiveFilter";
import { SITE_COPY } from "@/lib/site-copy";

// --- Types ---
export type GalleryItem = {
  id: number;
  title: string;
  description?: string;
  image_url: string;
  thumbnail_url?: string | null;
  image_width: number;
  image_height: number;
  tags: string[];
  gemini_tags: string[];
};

type TopTag = {
  tag: string;
  count: number;
};

// --- Skeleton Component ---
function GallerySkeleton() {
  const items = Array.from({ length: 12 });
  const masonryHeights = [240, 320, 210, 380, 290, 230, 350, 270, 310, 250, 340, 280];

  return (
    <div className="columns-2 gap-4 space-y-6 md:columns-3 md:gap-6 xl:columns-4">
      {items.map((_, i) => {
        const deterministicHeight = masonryHeights[i % masonryHeights.length];
        return (
          <div 
            key={i} 
            className="relative break-inside-avoid rounded-lg border border-gray-100 bg-gray-200 animate-pulse dark:border-[#302d28] dark:bg-[#1d1d1d]"
            style={{ height: `${deterministicHeight}px` }}
          ></div>
        );
      })}
    </div>
  );
}

// --- Props ---
interface GalleryClientProps {
  initialTopTags: TopTag[];
  initialGallery: GalleryItem[];
  initialTotalPages: number;
  initialPage: number;
}

// --- Main Component ---
export default function GalleryClient({ initialGallery, initialTotalPages, initialPage, initialTopTags }: GalleryClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const gallery = initialGallery;
  const totalPages = initialTotalPages;
  const page = initialPage;
  const [fetching, startTransition] = useTransition();
  const loading = false;
  const urlSearch = searchParams.get('search') || '';
  const selectedTags = (searchParams.get('tags') || '').split(',').filter(Boolean);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const topTags = initialTopTags;
  const loadingTags = false;
  const pageHref = (number: number, search = urlSearch, tags = selectedTags) => {
    const params = new URLSearchParams();
    if (number > 1) params.set('page', String(number));
    if (search.trim()) params.set('search', search.trim());
    if (tags.length) params.set('tags', tags.join(','));
    return `${pathname}${params.size ? `?${params}` : ''}`;
  };
  const requestedSearch = useRef<string | null>(null);
  const navigate = (url: string) => {
    requestedSearch.current = new URL(url, window.location.origin).searchParams.get('search') || '';
    startTransition(() => router.replace(url, { scroll: false }));
  };
  useEffect(() => {
    if (requestedSearch.current === urlSearch) { requestedSearch.current = null; return; }
    // Browser back/forward changes the input; an in-flight search must preserve newer typing.
    setSearchInput(urlSearch);
  }, [urlSearch]);
  useEffect(() => {
    if (searchInput.trim() === urlSearch) return;
    const timer = setTimeout(() => navigate(pageHref(1, searchInput)), 300);
    return () => clearTimeout(timer);
    // URL navigation fetches fresh server props; no second browser API request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, urlSearch]);
  const handleSearchChange = (value: string) => setSearchInput(value);
  const handleTagToggle = (tag: string) => navigate(pageHref(1, searchInput, selectedTags.includes(tag) ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag]));
  const updatePage = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const renderGalleryContent = () => {
    if (loading || (fetching && gallery.length === 0)) {
      return <GallerySkeleton />;
    }

    if (gallery.length === 0) {
      const hasActiveFilter = Boolean(searchInput.trim()) || selectedTags.length > 0;
      return (
        <div className="flex w-full flex-col items-center justify-center border-y border-[var(--archive-line)] py-20 text-center">
          <i className="ri-search-2-line text-4xl text-gray-300 mb-3"></i>
          <p className="text-base font-semibold text-[var(--archive-ink)]">
            {hasActiveFilter ? SITE_COPY.gallery.filteredEmpty : SITE_COPY.gallery.empty}
          </p>
          {hasActiveFilter && (
            <button
              onClick={() => { setSearchInput(''); navigate(pageHref(1, '', [])); }}
              className="mt-6 border border-[var(--archive-line)] bg-white px-5 py-2.5 text-sm font-medium transition-colors hover:border-[var(--archive-brand)] hover:text-[var(--archive-brand)]"
            >
              검색 조건 초기화
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="columns-2 gap-4 space-y-6 md:columns-3 md:gap-6 xl:columns-4">
        {gallery.map((item) => (
          <GalleryItemImage
            key={item.id}
            item={item}
            href={`/gallery/${item.id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="archive-page-shell min-h-screen">
      <section className="border-b border-[var(--archive-line)]">
        <div className="mx-auto max-w-[var(--archive-page)] px-4 pb-8 pt-14">
          <p className="archive-eyebrow mb-3 text-[var(--archive-faint)]">{SITE_COPY.gallery.eyebrow}</p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{SITE_COPY.gallery.title}</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--archive-muted)]">
            {SITE_COPY.gallery.description}
          </p>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-b border-[var(--archive-line)] bg-[var(--archive-canvas)]/95 backdrop-blur">
        <div className="mx-auto max-w-[var(--archive-page)] px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* 검색창 */}
            <div className="flex-1 relative group">
              <i className="ri-search-line absolute left-0 top-1/2 -translate-y-1/2 text-[var(--archive-muted)]"></i>
              <input
                type="text"
                aria-label="갤러리 검색"
                placeholder="제목, 설명, 태그로 검색"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full border-0 border-b border-[var(--archive-line)] bg-transparent py-2.5 pl-7 pr-10 text-[13px] outline-none transition-colors placeholder:text-[var(--archive-faint)] hover:border-[var(--archive-brand)] focus:border-[var(--archive-brand)]"
              />
              {searchInput && (
                <button
                  aria-label="갤러리 검색어 지우기"
                  onClick={() => { setSearchInput(''); }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-[var(--archive-muted)] transition-colors hover:text-[var(--archive-brand)]"
                >
                  <i className="ri-close-circle-fill text-lg"></i>
                </button>
              )}
            </div>

          </div>

          {/* 상단 태그 필터 */}
          {!loadingTags && topTags.length > 0 && (
            <nav className="flex gap-6 overflow-x-auto pt-2">
              {topTags.map((item) => (
                <button
                  key={item.tag}
                  aria-pressed={selectedTags.includes(item.tag)}
                  onClick={() => handleTagToggle(item.tag)}
                  className={`whitespace-nowrap border-b-2 pb-1 text-[13px] font-medium transition-colors ${
                    selectedTags.includes(item.tag)
                      ? 'border-[var(--archive-ink)] text-[var(--archive-ink)]'
                      : 'border-transparent text-[var(--archive-muted)] hover:text-[var(--archive-brand)]'
                  }`}
                >
                  #{item.tag}
                </button>
              ))}
            </nav>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[var(--archive-page)] px-4 py-10 pb-16">
        <div className="mb-4 flex items-center justify-between text-[12px] text-[var(--archive-muted)]">
          <span className="archive-eyebrow text-[var(--archive-faint)]">
            {selectedTags.length > 0 ? selectedTags.join(', ') : 'All'}
          </span>
          <span className="archive-index">{gallery.length} Items</span>
        </div>
        {/* 활성 필터 UI */}
        <div className="mb-2">
          <ActiveFilter />
        </div>

        {renderGalleryContent()}

        {/* 페이지네이션 */}
        {!loading && gallery.length > 0 && totalPages > 1 && (
          <div className={`mt-16 flex flex-wrap items-center justify-center gap-2 transition-opacity duration-200 ${fetching ? 'pointer-events-none opacity-50' : 'opacity-100'}`}>
            <Link
              href={pageHref(Math.max(1, page - 1))}
              onClick={updatePage}
              aria-disabled={page === 1}
              tabIndex={page === 1 ? -1 : undefined}
              className="border border-[var(--archive-line)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--archive-ink)] transition hover:border-[var(--archive-brand)] hover:bg-[var(--archive-brand)] hover:text-white aria-disabled:pointer-events-none aria-disabled:text-[var(--archive-muted)] aria-disabled:opacity-40"
            >
              Previous
            </Link>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
              <Link
                key={pageNumber}
                href={pageHref(pageNumber)}
                aria-current={pageNumber === page ? "page" : undefined}
                onClick={updatePage}
                className={`flex h-9 w-9 items-center justify-center text-[12px] font-semibold transition ${
                  pageNumber === page
                    ? 'bg-[var(--archive-ink)] text-[var(--archive-canvas)]'
                    : 'text-[var(--archive-muted)] hover:bg-[var(--archive-bg-light)] hover:text-[var(--archive-brand)]'
                }`}
              >
                {pageNumber}
              </Link>
            ))}
            <Link
              href={pageHref(Math.min(totalPages, page + 1))}
              onClick={updatePage}
              aria-disabled={page === totalPages}
              tabIndex={page === totalPages ? -1 : undefined}
              className="border border-[var(--archive-line)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--archive-ink)] transition hover:border-[var(--archive-brand)] hover:bg-[var(--archive-brand)] hover:text-white aria-disabled:pointer-events-none aria-disabled:text-[var(--archive-muted)] aria-disabled:opacity-40"
            >
              Next
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

// --- Image Item Component ---
function GalleryItemImage({ item, href }: { item: GalleryItem; href: string }) {
  return (
    <Link href={href} className="gallery-image-card group block break-inside-avoid" aria-label={`${item.title} 이미지 상세`}>
      <div className="relative w-full overflow-hidden bg-[var(--archive-bg-light)]" style={{ aspectRatio: `${item.image_width} / ${item.image_height}` }}>
        <Image
          src={item.thumbnail_url || item.image_url}
          alt={item.title}
          fill
          sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 300px"
          quality={75}
          className="object-cover group-hover:scale-[1.03] transition-transform duration-300 ease-out"
        />
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-[var(--archive-ink)] transition-colors group-hover:text-[var(--archive-brand)]">{item.title}</h3>
      {item.tags?.length > 0 && <p className="mt-1 text-xs leading-5 text-[var(--archive-muted)]">#{item.tags[0]} {item.tags.length > 1 && `+${item.tags.length - 1}`}</p>}
    </Link>
  );
}
