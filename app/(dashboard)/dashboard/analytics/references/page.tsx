import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpenText, MousePointerClick, Plus } from "lucide-react";

import { getReferencesAnalytics } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

const numberFormat = new Intl.NumberFormat("ko-KR");

function formatNumber(value: number) {
  return numberFormat.format(value);
}

function BarList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: { label: string; count: number }[];
  emptyText: string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
      </div>
      <div className="space-y-4 p-5">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="truncate font-medium text-gray-800">{item.label}</span>
                <span className="text-gray-500">{formatNumber(item.count)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-gray-100">
                <div
                  className="h-full rounded bg-gray-900"
                  style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-gray-500">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

export default async function ReferenceAnalyticsPage() {
  const analytics = await getReferencesAnalytics();

  if (!analytics) {
    redirect("/login");
  }

  return (
    <div>
      <header className="dashboard-Header">
        <div>
          <h1>레퍼런스 통계</h1>
          <p className="mt-1 text-xs text-gray-500">
            최근 1,000개 레퍼런스 기준으로 클릭과 범주 분포를 계산합니다.
          </p>
        </div>
        <Link
          href="/dashboard/contents/references"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          레퍼런스 추가
        </Link>
      </header>

      <main className="dashboard-container space-y-6">
        <Link
          href="/dashboard/analytics"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-950"
        >
          <ArrowLeft className="h-4 w-4" />
          통계 개요
        </Link>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <BookOpenText className="h-5 w-5 text-amber-600" />
            <p className="mt-4 text-sm text-gray-500">분석 대상 레퍼런스</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {formatNumber(analytics.total)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <MousePointerClick className="h-5 w-5 text-blue-600" />
            <p className="mt-4 text-sm text-gray-500">누적 클릭</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {formatNumber(analytics.totalClicks)}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <BarList title="범주" items={analytics.ranges} emptyText="범주 데이터가 없습니다." />
          <BarList title="월별 등록" items={analytics.months} emptyText="월별 데이터가 없습니다." />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-950">클릭 상위 레퍼런스</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {analytics.topClicked.length > 0 ? (
              analytics.topClicked.map((item) => (
                <a
                  key={item.id}
                  href={item.url || "/dashboard/contents/references"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50"
                >
                  <span className="truncate text-sm font-medium text-gray-950">{item.title}</span>
                  <span className="shrink-0 text-sm text-gray-500">
                    {formatNumber(item.clicks || 0)} 클릭
                  </span>
                </a>
              ))
            ) : (
              <p className="px-5 py-10 text-center text-sm text-gray-500">
                클릭 데이터가 없습니다.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
