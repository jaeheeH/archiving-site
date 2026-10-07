import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpenText, FileText, ImageIcon, Newspaper, Plus } from "lucide-react";

import { getDashboardOverview } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

const numberFormat = new Intl.NumberFormat("ko-KR");

function formatNumber(value: number) {
  return numberFormat.format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "날짜 없음";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function ContentsDashboardPage() {
  const overview = await getDashboardOverview();

  if (!overview) {
    redirect("/login?redirect=/dashboard/contents");
  }

  const sections = [
    {
      title: "뉴스",
      description: "수집한 소식을 한국어 기사로 가공하고 발행합니다.",
      count: overview.stats.newsTotal,
      detail: `${formatNumber(overview.stats.newsPublished)} 발행 · ${formatNumber(overview.stats.newsDraft)} 미발행`,
      href: "/dashboard/contents/news",
      createHref: null,
      icon: Newspaper,
      items: overview.latest.news.map(item => ({ id: item.id, title: item.title, href: `/dashboard/contents/news/${item.id}/edit`, date: item.updated_at, status: item.is_published ? "발행" : "미발행" })),
    },
    {
      title: "아트", description: "작품 정보와 작가 연결, 원출처를 관리합니다.", count: overview.stats.artworksTotal,
      href: "/dashboard/contents/art", createHref: ["admin", "sub-admin"].includes(overview.viewer.role) ? "/dashboard/contents/art/create" : null, icon: ImageIcon,
      items: overview.latest.artworks.map(item => ({ id: item.id, title: item.title_ko, href: `/dashboard/contents/art/${item.id}/edit`, date: item.collected_at, status: item.museum })),
    },
    {
      title: "작가", description: "작가 정보와 연결된 작품을 관리합니다.", count: overview.stats.artistsTotal,
      href: "/dashboard/contents/artists", createHref: ["admin", "sub-admin"].includes(overview.viewer.role) ? "/dashboard/contents/artists/create" : null, icon: FileText,
      items: overview.latest.artists.map(item => ({ id: item.id, title: item.name_ko || item.name, href: `/dashboard/contents/artists/${item.id}/edit`, date: null, status: `작품 ${item.artwork_ids.length}점` })),
    },
    {
      title: "에디토리얼",
      description: "발행 글과 임시저장 글을 관리합니다.",
      count: overview.stats.postsTotal,
      detail: `${formatNumber(overview.stats.postsPublished)} 발행 · ${formatNumber(
        overview.stats.postsDraft
      )} 임시저장`,
      href: "/dashboard/contents/blog",
      createHref: "/dashboard/contents/blog/create",
      icon: FileText,
      items: overview.latest.posts.map((item) => ({
        id: item.id,
        title: item.title,
        href: `/dashboard/contents/blog/${item.id}/edit`,
        date: item.updated_at,
        status: item.is_published ? "발행" : "임시저장",
      })),
    },
    {
      title: "갤러리",
      description: "이미지 아카이브와 분석 태그를 정리합니다.",
      count: overview.stats.galleryTotal,
      href: "/dashboard/contents/gallery",
      createHref: "/dashboard/contents/gallery/create",
      icon: ImageIcon,
      items: overview.latest.gallery.map((item) => ({
        id: item.id,
        title: item.title,
        href: `/dashboard/contents/gallery/${item.id}/edit`,
        date: item.created_at,
        status: item.category || "미분류",
      })),
    },
    {
      title: "참고사이트",
      description: "수집한 링크와 범주를 관리합니다.",
      count: overview.stats.referencesTotal,
      href: "/dashboard/contents/references",
      createHref: "/dashboard/contents/references",
      icon: BookOpenText,
      items: overview.latest.references.map((item) => ({
        id: item.id,
        title: item.title,
        href: "/dashboard/contents/references",
        date: item.created_at,
        status: `${formatNumber(item.clicks || 0)} 클릭`,
      })),
    },
  ].sort((a, b) => ["뉴스", "아트", "작가", "참고사이트", "에디토리얼", "갤러리"].indexOf(a.title) - ["뉴스", "아트", "작가", "참고사이트", "에디토리얼", "갤러리"].indexOf(b.title));

  return (
    <div>
      <header className="dashboard-Header">
        <div>
          <h1>콘텐츠 관리</h1>
          <p className="mt-1 text-xs text-gray-500">
            뉴스, 아트, 작가, 참고사이트, 에디토리얼, 갤러리를 한 곳에서 점검합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/contents/gallery/create"
            className="content-table-action"
          >
            <ImageIcon className="h-4 w-4" />
            이미지 추가
          </Link>
          <Link
            href="/dashboard/contents/blog/create"
            className="content-table-create"
          >
            <Plus className="h-4 w-4" />
            글 작성
          </Link>
        </div>
      </header>

      <main className="dashboard-container space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <div key={section.title} className="rounded-lg border border-gray-200 bg-white">
                <div className="border-b border-gray-100 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-gray-700">
                          <Icon className="h-4 w-4" />
                        </span>
                        <h2 className="text-base font-semibold text-gray-950">{section.title}</h2>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-gray-500">{section.description}</p>
                    </div>
                    <p className="text-3xl font-semibold text-gray-950">
                      {formatNumber(section.count)}
                    </p>
                  </div>
                  {section.detail && (
                    <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      {section.detail}
                    </p>
                  )}
                </div>

                <div className="divide-y divide-gray-100">
                  {section.items.length > 0 ? (
                    section.items.slice(0, 4).map((item) => (
                      <Link
                        key={`${section.title}-${item.id}`}
                        href={item.href}
                        className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-950">
                            {item.title}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">{item.status}</span>
                        </span>
                        <span className="shrink-0 text-xs text-gray-500">
                          {formatDate(item.date)}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <div className="px-5 py-10 text-center text-sm text-gray-500">
                      아직 등록된 항목이 없습니다.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 p-4">
                  <Link
                    href={section.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-950"
                  >
                    관리하기
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  {section.createHref && <Link
                    href={section.createHref}
                    className="content-table-action"
                  >
                    추가
                  </Link>}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
