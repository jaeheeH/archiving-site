import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, BookOpenText, Eye, ImageIcon, MousePointerClick } from "lucide-react";

import { getDashboardOverview } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

const numberFormat = new Intl.NumberFormat("ko-KR");

function formatNumber(value: number) {
  return numberFormat.format(value);
}

export default async function AnalyticsPage() {
  const overview = await getDashboardOverview();

  if (!overview) {
    redirect("/login");
  }

  const panels = [
    {
      title: "갤러리 분석",
      description: "카테고리, 범위, 태그 분포를 확인합니다.",
      href: "/dashboard/analytics/gallery",
      value: overview.stats.galleryTotal,
      label: "이미지",
      icon: ImageIcon,
    },
    {
      title: "레퍼런스 분석",
      description: "클릭 수와 범주별 수집 현황을 봅니다.",
      href: "/dashboard/analytics/references",
      value: overview.stats.referencesTotal,
      label: "레퍼런스",
      icon: BookOpenText,
    },
  ];

  return (
    <div>
      <header className="dashboard-Header">
        <div>
          <h1>통계</h1>
          <p className="mt-1 text-xs text-gray-500">
            콘텐츠 규모와 반응 지표를 빠르게 확인합니다.
          </p>
        </div>
      </header>

      <main className="dashboard-container space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <p className="mt-4 text-sm text-gray-500">전체 콘텐츠</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {formatNumber(overview.stats.contentTotal)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <Eye className="h-5 w-5 text-emerald-600" />
            <p className="mt-4 text-sm text-gray-500">블로그 누적 조회</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {formatNumber(
                overview.top.posts.reduce((sum, post) => sum + (post.view_count || 0), 0)
              )}
            </p>
            <p className="mt-2 text-xs text-gray-500">상위 5개 글 기준</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <MousePointerClick className="h-5 w-5 text-amber-600" />
            <p className="mt-4 text-sm text-gray-500">레퍼런스 클릭</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {formatNumber(
                overview.top.references.reduce((sum, item) => sum + (item.clicks || 0), 0)
              )}
            </p>
            <p className="mt-2 text-xs text-gray-500">상위 5개 레퍼런스 기준</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {panels.map((panel) => {
            const Icon = panel.icon;

            return (
              <Link
                key={panel.title}
                href={panel.href}
                className="rounded-lg border border-gray-200 bg-white p-5 transition hover:border-gray-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
                <h2 className="mt-5 text-base font-semibold text-gray-950">{panel.title}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">{panel.description}</p>
                <p className="mt-5 text-sm text-gray-500">
                  <span className="text-2xl font-semibold text-gray-950">
                    {formatNumber(panel.value)}
                  </span>{" "}
                  {panel.label}
                </p>
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}
