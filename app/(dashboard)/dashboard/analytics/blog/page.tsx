import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookMarked, Eye, FileText, Plus } from "lucide-react";

import { getBlogAnalytics } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

const numberFormat = new Intl.NumberFormat("ko-KR");

function formatNumber(value: number) {
  return numberFormat.format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "날짜 없음";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
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

function RankedPostList({
  title,
  items,
  metricLabel,
  metricKey,
}: {
  title: string;
  items: {
    id: string;
    title: string;
    slug: string | null;
    is_published: boolean | null;
    updated_at: string | null;
    published_at: string | null;
    view_count: number | null;
    scrap_count: number | null;
  }[];
  metricLabel: string;
  metricKey: "view_count" | "scrap_count";
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {items.length > 0 ? (
          items.map((item, index) => (
            <Link
              key={item.id}
              href={`/dashboard/contents/blog/${item.id}/edit`}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-bold text-gray-600">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-950">{item.title}</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {item.is_published ? "발행" : "임시저장"} · {formatDate(item.published_at || item.updated_at)}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-sm text-gray-500">
                {formatNumber(item[metricKey] || 0)} {metricLabel}
              </span>
            </Link>
          ))
        ) : (
          <p className="px-5 py-10 text-center text-sm text-gray-500">표시할 블로그가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

export default async function BlogAnalyticsPage() {
  const analytics = await getBlogAnalytics();

  if (!analytics) {
    redirect("/login?redirect=/dashboard/analytics/blog");
  }

  return (
    <div>
      <header className="dashboard-Header">
        <div>
          <h1>블로그 통계</h1>
          <p className="mt-1 text-xs text-gray-500">
            최근 1,000개 블로그 기준으로 조회, 북마크, 분포를 계산합니다.
          </p>
        </div>
        <Link
          href="/dashboard/contents/blog/create"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          새 글 작성
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <FileText className="h-5 w-5 text-emerald-600" />
            <p className="mt-4 text-sm text-gray-500">분석 대상 블로그</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {formatNumber(analytics.total)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <FileText className="h-5 w-5 text-blue-600" />
            <p className="mt-4 text-sm text-gray-500">발행 / 임시저장</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {formatNumber(analytics.published)} / {formatNumber(analytics.draft)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <Eye className="h-5 w-5 text-indigo-600" />
            <p className="mt-4 text-sm text-gray-500">누적 조회</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {formatNumber(analytics.totalViews)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <BookMarked className="h-5 w-5 text-amber-600" />
            <p className="mt-4 text-sm text-gray-500">누적 북마크</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {formatNumber(analytics.totalScraps)}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <BarList title="카테고리" items={analytics.categories} emptyText="카테고리 데이터가 없습니다." />
          <BarList title="태그" items={analytics.tags} emptyText="태그 데이터가 없습니다." />
          <BarList title="월별 작성" items={analytics.months} emptyText="월별 데이터가 없습니다." />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <RankedPostList
            title="조회 상위 블로그"
            items={analytics.topViewed}
            metricKey="view_count"
            metricLabel="조회"
          />
          <RankedPostList
            title="북마크 상위 블로그"
            items={analytics.topScrapped}
            metricKey="scrap_count"
            metricLabel="북마크"
          />
        </section>
      </main>
    </div>
  );
}
