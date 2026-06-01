"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BookmarkCheck, ExternalLink, FileText, ImageIcon, Loader2 } from "lucide-react";

import { useToast } from "@/components/ToastProvider";

type Reference = {
  id: number;
  title: string;
  description: string | null;
  url: string | null;
  image_url: string | null;
  logo_url: string | null;
  range: string[] | null;
  created_at: string | null;
};

type Gallery = {
  id: number;
  title: string;
  image_url: string | null;
  tags: string[] | null;
  description: string | null;
  created_at: string | null;
};

type BlogPost = {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  slug: string;
  title_image_url: string | null;
  published_at: string | null;
  created_at: string | null;
  scrap_count: number | null;
};

type ActivityType = "blog" | "gallery" | "reference";

type ActivityTabProps = {
  initialPosts: BlogPost[];
  initialGalleries: Gallery[];
  initialReferences: Reference[];
};

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(value?: string | null) {
  if (!value) return "날짜 없음";
  return dateFormat.format(new Date(value));
}

function formatDomain(url?: string | null) {
  if (!url) return "링크 없음";

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
}

export default function ActivityTab({ initialPosts, initialGalleries, initialReferences }: ActivityTabProps) {
  const searchParams = useSearchParams();
  const toastContext = useToast();
  const addToast = toastContext?.addToast || (() => {});
  const initialTab = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<ActivityType>(() => {
    if (initialTab === "blog" || initialTab === "gallery" || initialTab === "reference") {
      return initialTab;
    }

    if (initialPosts.length > 0) return "blog";
    return initialGalleries.length > 0 || initialReferences.length === 0 ? "gallery" : "reference";
  });
  const [posts, setPosts] = useState(initialPosts);
  const [references, setReferences] = useState(initialReferences);
  const [galleries, setGalleries] = useState(initialGalleries);
  const [scrappingIds, setScrappingIds] = useState<Set<string>>(new Set());

  const stats = useMemo(
    () => [
      { id: "blog" as const, label: "Blog", count: posts.length },
      { id: "gallery" as const, label: "Gallery", count: galleries.length },
      { id: "reference" as const, label: "References", count: references.length },
    ],
    [posts.length, galleries.length, references.length]
  );

  const handleUnscrap = async (
    event: React.MouseEvent<HTMLButtonElement>,
    id: number | string,
    type: ActivityType
  ) => {
    event.stopPropagation();
    event.preventDefault();

    const key = `${type}-${id}`;
    if (scrappingIds.has(key)) return;

    try {
      setScrappingIds((prev) => new Set(prev).add(key));

      const endpoint =
        type === "blog"
          ? `/api/posts/${id}/scrap`
          : type === "gallery"
            ? `/api/gallery/${id}/scrap`
            : `/api/references/${id}/scrap`;
      const response = await fetch(endpoint, { method: "POST" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "스크랩 처리에 실패했습니다.");
      }

      if (!data.scraped) {
        if (type === "blog") {
          setPosts((prev) => prev.filter((item) => item.id !== id));
        } else if (type === "gallery") {
          setGalleries((prev) => prev.filter((item) => item.id !== id));
        } else {
          setReferences((prev) => prev.filter((item) => item.id !== id));
        }
        addToast("저장이 취소되었습니다.", "success");
      }
    } catch (error) {
      console.error("Unscrap failed:", error);
      addToast(error instanceof Error ? error.message : "오류가 발생했습니다.", "error");
    } finally {
      setScrappingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <section className="w-full">
      <div className="mb-6">
        <p className="archive-eyebrow mb-3 text-[var(--archive-faint)]">Activity</p>
        <h2 className="text-2xl font-bold tracking-tight text-gray-950">내 활동</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--archive-muted)]">
          북마크한 블로그와 저장한 갤러리, 레퍼런스를 확인합니다.
        </p>
      </div>

      <div className="mb-8 flex items-center gap-6 overflow-x-auto border-b border-[var(--archive-line)]">
        {stats.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`relative inline-flex h-11 shrink-0 items-center gap-2 text-[13px] font-semibold transition ${
              activeTab === tab.id ? "text-gray-950" : "text-[var(--archive-muted)] hover:text-[#ff4800]"
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === tab.id ? "bg-gray-950 text-white" : "bg-gray-100 text-[var(--archive-muted)]"
              }`}
            >
              {tab.count}
            </span>
            {activeTab === tab.id && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gray-950" />}
          </button>
        ))}
      </div>

      {activeTab === "blog" &&
        (posts.length === 0 ? (
          <EmptyState type="blog" />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {posts.map((item) => {
              const isRemoving = scrappingIds.has(`blog-${item.id}`);
              const excerpt = item.summary || item.subtitle || "요약이 없습니다.";

              return (
                <Link
                  key={item.id}
                  href={`/blog/${item.slug}`}
                  className="group overflow-hidden rounded-lg border border-[var(--archive-line)] bg-white transition hover:border-[#ff4800] hover:shadow-sm"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
                    {item.title_image_url ? (
                      <Image
                        src={item.title_image_url}
                        alt={item.title}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <FileText className="h-8 w-8" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(event) => handleUnscrap(event, item.id, "blog")}
                      disabled={isRemoving}
                      className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#ff4800] shadow-sm transition hover:text-red-600 disabled:opacity-60"
                      title="북마크 취소"
                    >
                      {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkCheck className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-[#ff4800]">
                      <FileText className="h-3.5 w-3.5" />
                      Blog
                    </div>
                    <h3 className="line-clamp-2 text-sm font-semibold leading-6 text-gray-950">{item.title}</h3>
                    <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[var(--archive-muted)]">{excerpt}</p>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--archive-line)] pt-3 text-xs text-[var(--archive-muted)]">
                      <span>{formatDate(item.published_at || item.created_at)}</span>
                      <span className="shrink-0">저장 {item.scrap_count ?? 0}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ))}

      {activeTab === "gallery" &&
        (galleries.length === 0 ? (
          <EmptyState type="gallery" />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {galleries.map((item) => {
              const isRemoving = scrappingIds.has(`gallery-${item.id}`);

              return (
                <Link
                  key={item.id}
                  href={`/gallery/${item.id}`}
                  className="group overflow-hidden rounded-lg border border-[var(--archive-line)] bg-white transition hover:border-[#ff4800] hover:shadow-sm"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.title}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(event) => handleUnscrap(event, item.id, "gallery")}
                      disabled={isRemoving}
                      className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#ff4800] shadow-sm transition hover:text-red-600 disabled:opacity-60"
                      title="스크랩 취소"
                    >
                      {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkCheck className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="p-4">
                    <h3 className="truncate text-sm font-semibold text-gray-950">{item.title}</h3>
                    <p className="mt-1 text-xs text-[var(--archive-muted)]">{formatDate(item.created_at)}</p>
                    {item.tags?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded border border-[var(--archive-line)] bg-white px-1.5 py-0.5 text-[11px] text-[var(--archive-muted)]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}

      {activeTab === "reference" &&
        (references.length === 0 ? (
          <EmptyState type="reference" />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {references.map((item) => {
              const isRemoving = scrappingIds.has(`reference-${item.id}`);

              return (
                <Link
                  key={item.id}
                  href={item.url || "/references"}
                  target={item.url ? "_blank" : undefined}
                  rel={item.url ? "noopener noreferrer" : undefined}
                  className="group overflow-hidden rounded-lg border border-[var(--archive-line)] bg-white transition hover:border-[#ff4800] hover:shadow-sm"
                >
                  <div className="relative aspect-video overflow-hidden bg-gray-100">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.title}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <ExternalLink className="h-8 w-8" />
                      </div>
                    )}

                    <span className="absolute left-3 top-3 rounded bg-gray-950/75 px-2 py-1 text-[10px] font-medium uppercase text-white">
                      {item.range?.[0] || "REF"}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => handleUnscrap(event, item.id, "reference")}
                      disabled={isRemoving}
                      className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#ff4800] shadow-sm transition hover:text-red-600 disabled:opacity-60"
                      title="스크랩 취소"
                    >
                      {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkCheck className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="p-4">
                    <h3 className="line-clamp-1 text-sm font-semibold text-gray-950">{item.title}</h3>
                    <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-5 text-gray-500">
                      {item.description || "설명이 없습니다."}
                    </p>
                    <div className="mt-4 flex items-center gap-2 border-t border-[var(--archive-line)] pt-3 text-xs text-[var(--archive-muted)]">
                      {item.logo_url ? (
                        <Image src={item.logo_url} width={16} height={16} alt="" className="rounded-sm" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5" />
                      )}
                      <span className="truncate">{formatDomain(item.url)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
    </section>
  );
}

function EmptyState({ type }: { type: ActivityType }) {
  const config = {
    blog: {
      icon: <FileText className="h-6 w-6" />,
      title: "북마크한 블로그가 없습니다.",
      href: "/blog",
      cta: "블로그 읽으러 가기",
    },
    gallery: {
      icon: <ImageIcon className="h-6 w-6" />,
      title: "보관한 갤러리가 없습니다.",
      href: "/gallery",
      cta: "갤러리 탐색하기",
    },
    reference: {
      icon: <ExternalLink className="h-6 w-6" />,
      title: "보관한 레퍼런스가 없습니다.",
      href: "/references",
      cta: "레퍼런스 탐색하기",
    },
  }[type];

  return (
    <div className="rounded-lg border border-dashed border-[var(--archive-line)] bg-white px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--archive-line)] bg-white text-[var(--archive-muted)]">
        {config.icon}
      </div>
      <p className="text-sm font-medium text-gray-700">{config.title}</p>
      <Link
        href={config.href}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-medium text-white transition hover:bg-[#ff4800]"
      >
        {config.cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
