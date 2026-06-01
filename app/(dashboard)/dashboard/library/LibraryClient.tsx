"use client";

import { useMemo, useState } from "react";
import { Copy, Download, ExternalLink, Search, Trash2, X } from "lucide-react";

type GeneratedImage = {
  id: string;
  image_url: string;
  prompt: string | null;
  aspect_ratio: string | null;
  seed: number | null;
  created_at: string | null;
  brands?: {
    name?: string | null;
  } | null;
};

type Props = {
  initialImages: GeneratedImage[];
};

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

export default function LibraryClient({ initialImages }: Props) {
  const [images, setImages] = useState(initialImages);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedSeed, setCopiedSeed] = useState<number | null>(null);
  const [brandFilter, setBrandFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const total = useMemo(() => images.length, [images.length]);
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const brandOptions = useMemo(() => {
    return Array.from(
      new Set(
        images
          .map((img) => img.brands?.name?.trim())
          .filter((name): name is string => Boolean(name))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [images]);

  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      const brandName = img.brands?.name?.trim() || "브랜드 없음";
      const matchesBrand = brandFilter === "all" || brandName === brandFilter;

      if (!matchesBrand) return false;
      if (!normalizedSearchTerm) return true;

      return [
        brandName,
        img.prompt,
        img.aspect_ratio,
        img.seed !== null && img.seed !== undefined ? String(img.seed) : null,
      ]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(normalizedSearchTerm));
    });
  }, [brandFilter, images, normalizedSearchTerm]);

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

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-950">
              {filteredImages.length === total
                ? `총 ${total}개 이미지`
                : `${filteredImages.length}개 표시 / 총 ${total}개`}
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
              {brandOptions.map((brand) => (
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

      {filteredImages.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-gray-950">조건에 맞는 이미지가 없습니다.</p>
          <p className="mt-2 text-sm text-gray-500">
            브랜드 필터나 검색어를 조정해보세요.
          </p>
          {hasActiveFilters && (
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
        <div className="columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3 2xl:columns-4">
        {filteredImages.map((img) => (
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
                <a
                  href={img.image_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-white/95 text-gray-700 shadow-sm hover:bg-white"
                  title="원본 다운로드"
                >
                  <Download className="h-4 w-4" />
                </a>
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

              <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
                {formatDate(img.created_at)}
              </p>
            </div>
          </article>
        ))}
        </div>
      )}
    </section>
  );
}
