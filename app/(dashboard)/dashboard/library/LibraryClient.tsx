"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, ExternalLink, Loader2, Search, Sparkles, Trash2, X } from "lucide-react";

type GeneratedImage = {
  id: string;
  brand_id?: string | null;
  image_url: string;
  prompt: string | null;
  subject_prompt?: string | null;
  lighting?: string | null;
  camera?: string | null;
  vibe?: string | null;
  background?: string | null;
  prompt_mode?: string | null;
  aspect_ratio: string | null;
  seed: number | null;
  created_at: string | null;
  brands?: {
    name?: string | null;
  } | null;
};

type Props = {
  initialImages: GeneratedImage[];
  initialTotal: number;
  initialHasMore: boolean;
  brandOptions: string[];
};

const LIBRARY_PAGE_SIZE = 40;

function formatDate(value?: string | null) {
  if (!value) return "날짜 없음";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getImageExtension(contentType: string, imageUrl: string) {
  const mime = contentType.split(";")[0]?.trim().toLowerCase();

  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";

  try {
    const pathname = new URL(imageUrl).pathname;
    const match = pathname.match(/\.(png|jpe?g|webp|gif)$/i);
    if (match?.[1]) return match[1].replace("jpeg", "jpg").toLowerCase();
  } catch {}

  return "png";
}

function getGenerationOptions(img: GeneratedImage) {
  return [
    img.lighting ? `조명 ${img.lighting}` : null,
    img.camera ? `카메라 ${img.camera}` : null,
    img.vibe ? `분위기 ${img.vibe}` : null,
    img.background ? `배경 ${img.background}` : null,
  ].filter((option): option is string => Boolean(option));
}

export default function LibraryClient({
  initialImages,
  initialTotal,
  initialHasMore,
  brandOptions,
}: Props) {
  const [images, setImages] = useState(initialImages);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedSeed, setCopiedSeed] = useState<number | null>(null);
  const [brandFilter, setBrandFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const didMountRef = useRef(false);
  const loadingRef = useRef(false);
  const imagesLengthRef = useRef(initialImages.length);
  const normalizedSearchTerm = debouncedSearchTerm.trim();

  const sortedBrandOptions = useMemo(
    () => [...brandOptions].sort((a, b) => a.localeCompare(b)),
    [brandOptions]
  );

  const hasActiveFilters = brandFilter !== "all" || normalizedSearchTerm.length > 0;

  const resetFilters = () => {
    setBrandFilter("all");
    setSearchTerm("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 이미지를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.")) return;

    setDeletingId(id);

    try {
      const res = await fetch("/api/images/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "삭제 실패");
      }

      setImages((prev) => prev.filter((img) => img.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      alert(error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopySeed = async (seed: number) => {
    await navigator.clipboard.writeText(String(seed));
    setCopiedSeed(seed);
    window.setTimeout(() => setCopiedSeed(null), 1200);
  };

  const handleDownloadOriginal = async (img: GeneratedImage) => {
    try {
      const response = await fetch(img.image_url);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const extension = getImageExtension(blob.type || response.headers.get("content-type") || "", img.image_url);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = `arch-b-${img.id}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
    } catch {
      alert("다운로드에 실패했습니다. 새 탭에서 이미지를 열어 저장해 주세요.");
    }
  };

  const handleSendToStudio = (img: GeneratedImage) => {
    const params = new URLSearchParams({ from: "library" });

    if (img.brand_id) params.set("brand", img.brand_id);

    window.sessionStorage.setItem(
      "archb_studio_import",
      JSON.stringify({
        brandId: img.brand_id || "",
        prompt: img.prompt || "",
        subjectPrompt: img.subject_prompt || "",
        lighting: img.lighting || "",
        camera: img.camera || "",
        vibe: img.vibe || "",
        background: img.background || "",
        promptMode: img.prompt_mode || "",
        aspectRatio: img.aspect_ratio || "1:1",
        seed: img.seed ?? null,
      })
    );
    window.location.assign(`/dashboard/studio?${params.toString()}`);
  };

  useEffect(() => {
    imagesLengthRef.current = images.length;
  }, [images.length]);

  const loadImages = useCallback(
    async ({ reset = false }: { reset?: boolean } = {}) => {
      if (loadingRef.current) return;

      const offset = reset ? 0 : imagesLengthRef.current;
      const params = new URLSearchParams({
        limit: String(LIBRARY_PAGE_SIZE),
        offset: String(offset),
      });

      if (brandFilter !== "all") params.set("brand", brandFilter);
      if (normalizedSearchTerm) params.set("search", normalizedSearchTerm);

      setLoadError("");
      if (reset) setIsRefreshing(true);
      else setIsLoadingMore(true);
      loadingRef.current = true;

      try {
        const response = await fetch(`/api/library?${params.toString()}`, {
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.error || "라이브러리를 불러오지 못했습니다.");
        }

        const nextImages = Array.isArray(result.images)
          ? (result.images as GeneratedImage[])
          : [];
        const nextPagination = result.pagination || {};

        setImages((prev) => {
          if (reset) return nextImages;

          const seen = new Set(prev.map((image) => image.id));
          return [
            ...prev,
            ...nextImages.filter((image) => !seen.has(image.id)),
          ];
        });
        setTotalCount(
          typeof nextPagination.total === "number"
            ? nextPagination.total
            : nextImages.length
        );
        setHasMore(Boolean(nextPagination.hasMore));
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "라이브러리를 불러오지 못했습니다."
        );
      } finally {
        setIsRefreshing(false);
        setIsLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [brandFilter, normalizedSearchTerm]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    loadImages({ reset: true });
  }, [brandFilter, debouncedSearchTerm, loadImages]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || isLoadingMore || isRefreshing) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadImages();
        }
      },
      { rootMargin: "600px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isRefreshing, loadImages]);

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-950">
              {images.length}개 표시 / 총 {totalCount}개
            </p>
            <p className="mt-1 text-xs text-gray-500">
              브랜드명, 프롬프트, 비율, 시드로 검색할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="library-brand-filter">
              브랜드 필터
            </label>
            <select
              id="library-brand-filter"
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
              className="h-10 min-w-44 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-gray-400"
            >
              <option value="all">전체 브랜드</option>
              {sortedBrandOptions.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <label className="sr-only" htmlFor="library-search">
                라이브러리 검색
              </label>
              <input
                id="library-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="검색어 입력"
                className="h-10 w-full rounded-md border border-gray-200 bg-white pl-9 pr-9 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-gray-400 sm:w-72"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  title="검색어 지우기"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-10 rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-950"
              >
                초기화
              </button>
            )}
          </div>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          {isRefreshing ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <p className="mt-3 text-sm font-semibold text-gray-950">이미지를 불러오는 중입니다.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-950">조건에 맞는 이미지가 없습니다.</p>
              <p className="mt-2 text-sm text-gray-500">
                브랜드 필터나 검색어를 조정해보세요.
              </p>
            </>
          )}
          {hasActiveFilters && !isRefreshing && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 inline-flex h-9 items-center rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800"
            >
              필터 초기화
            </button>
          )}
        </div>
      ) : (
        <>
        <div className={`columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-5 2xl:columns-6 ${isRefreshing ? "opacity-50" : ""}`}>
        {images.map((img) => {
          const generationOptions = getGenerationOptions(img);

          return (
          <article
            key={img.id}
            className="group mb-4 break-inside-avoid overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 hover:shadow-md"
          >
            <div className="relative bg-gray-100">
              <img
                src={img.image_url}
                alt={img.prompt || "Generated image"}
                loading="lazy"
                className="h-auto w-full object-cover"
              />

              <div className="absolute right-2 top-2 flex gap-2 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => handleSendToStudio(img)}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-white/95 text-gray-700 shadow-sm hover:bg-white"
                  title="Studio로 가져가기"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadOriginal(img)}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-white/95 text-gray-700 shadow-sm hover:bg-white"
                  title="원본 다운로드"
                >
                  <Download className="h-4 w-4" />
                </button>
                <a
                  href={img.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-white/95 text-gray-700 shadow-sm hover:bg-white"
                  title="새 탭에서 열기"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(img.id)}
                  disabled={deletingId === img.id}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-white/95 text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
                  title="영구 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
                {img.aspect_ratio || "1:1"}
              </span>
            </div>

            <div className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="truncate rounded bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                  {img.brands?.name || "브랜드 없음"}
                </span>
                {img.seed !== null && img.seed !== undefined && (
                  <button
                    type="button"
                    onClick={() => handleCopySeed(img.seed!)}
                    className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600 hover:bg-white hover:text-gray-950"
                    title="시드 복사"
                  >
                    <Copy className="h-3 w-3" />
                    {copiedSeed === img.seed ? "복사됨" : img.seed}
                  </button>
                )}
              </div>

              <p className="line-clamp-3 text-sm leading-6 text-gray-800" title={img.prompt || ""}>
                {img.prompt || "프롬프트 없음"}
              </p>

              {generationOptions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {generationOptions.map((option) => (
                    <span
                      key={option}
                      className="max-w-full truncate rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-600"
                      title={option}
                    >
                      {option}
                    </span>
                  ))}
                </div>
              )}

              <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
                {formatDate(img.created_at)}
              </p>
            </div>
          </article>
          );
        })}
        </div>
        <div ref={loadMoreRef} className="flex min-h-16 items-center justify-center py-4 text-sm text-gray-500">
          {isLoadingMore ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              더 불러오는 중
            </span>
          ) : loadError ? (
            <button
              type="button"
              onClick={() => loadImages()}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              다시 불러오기
            </button>
          ) : hasMore ? (
            <span>아래로 스크롤하면 더 불러옵니다.</span>
          ) : (
            <span>모든 이미지를 불러왔습니다.</span>
          )}
        </div>
        </>
      )}
    </section>
  );
}
