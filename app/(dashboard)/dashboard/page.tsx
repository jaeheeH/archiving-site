import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpenText,
  FileText,
  ImageIcon,
  Library,
  LineChart,
  Sparkles,
  Users,
} from "lucide-react";

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
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function roleLabel(role: string) {
  if (role === "admin") return "관리자";
  if (role === "sub-admin") return "부관리자";
  if (role === "editor") return "에디터";
  return "사용자";
}

export default async function DashboardMain() {
  const overview = await getDashboardOverview();

  if (!overview) {
    redirect("/login?redirect=/dashboard");
  }

  const statCards = [
    {
      label: "전체 콘텐츠",
      value: overview.stats.contentTotal,
      href: "/dashboard/contents",
      icon: Library,
      tone: "text-blue-600 bg-blue-50",
    },
    {
      label: "블로그",
      value: overview.stats.postsTotal,
      detail: `${formatNumber(overview.stats.postsPublished)} 발행 · ${formatNumber(
        overview.stats.postsDraft
      )} 임시저장`,
      href: "/dashboard/contents/blog",
      icon: FileText,
      tone: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "갤러리",
      value: overview.stats.galleryTotal,
      href: "/dashboard/contents/gallery",
      icon: ImageIcon,
      tone: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "레퍼런스",
      value: overview.stats.referencesTotal,
      href: "/dashboard/contents/references",
      icon: BookOpenText,
      tone: "text-amber-600 bg-amber-50",
    },
  ];

  const quickActions = [
    {
      title: "블로그 작성",
      description: "글 초안 작성, 커버 이미지, 태그, 발행 상태를 관리합니다.",
      href: "/dashboard/contents/blog/create",
      icon: FileText,
    },
    {
      title: "갤러리 업로드",
      description: "이미지 분석과 태그 자동화를 포함해 갤러리 콘텐츠를 추가합니다.",
      href: "/dashboard/contents/gallery/create",
      icon: ImageIcon,
    },
    {
      title: "AI Studio",
      description: "학습된 브랜드 모델로 새 이미지를 생성하고 라이브러리에 저장합니다.",
      href: "/dashboard/studio",
      icon: Sparkles,
    },
    {
      title: "운영 통계",
      description: "콘텐츠 분포와 조회 흐름을 확인합니다.",
      href: "/dashboard/analytics",
      icon: LineChart,
    },
  ];

  return (
    <div>
      <header className="dashboard-Header">
        <div>
          <h1>대시보드</h1>
          <p className="mt-1 text-xs text-gray-500">
            {overview.viewer.nickname} · {roleLabel(overview.viewer.role)}
          </p>
        </div>
        <Link
          href="/dashboard/contents/blog/create"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          <FileText className="h-4 w-4" />
          새 글 작성
        </Link>
      </header>

      <main className="dashboard-container space-y-6">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg border border-gray-200 bg-white p-5 transition hover:border-gray-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-500">{item.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-normal text-gray-950">
                      {formatNumber(item.value)}
                    </p>
                    {item.detail && (
                      <p className="mt-2 text-xs text-gray-500">{item.detail}</p>
                    )}
                  </div>
                  <span className={`rounded-md p-2 ${item.tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-950">최근 업데이트</h2>
                <p className="mt-1 text-xs text-gray-500">블로그, 갤러리, 레퍼런스의 최신 작업</p>
              </div>
              <Link
                href="/dashboard/contents"
                className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-950"
              >
                전체 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="divide-y divide-gray-100">
              {overview.latest.posts.map((post) => (
                <Link
                  key={`post-${post.id}`}
                  href={`/dashboard/contents/blog/${post.id}/edit`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        블로그
                      </span>
                      {!post.is_published && (
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                          임시저장
                        </span>
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-gray-950">{post.title}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">{formatDate(post.updated_at)}</span>
                </Link>
              ))}

              {overview.latest.gallery.slice(0, 3).map((item) => (
                <Link
                  key={`gallery-${item.id}`}
                  href={`/dashboard/contents/gallery/${item.id}/edit`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <span className="rounded bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                      갤러리
                    </span>
                    <p className="mt-2 truncate text-sm font-medium text-gray-950">{item.title}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">{formatDate(item.created_at)}</span>
                </Link>
              ))}

              {overview.latest.posts.length === 0 && overview.latest.gallery.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-gray-500">
                  아직 최근 작업이 없습니다.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-950">빠른 작업</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {quickActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <Link
                      key={action.title}
                      href={action.href}
                      className="flex gap-3 px-5 py-4 hover:bg-gray-50"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-700">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-950">{action.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-gray-500">
                          {action.description}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {(overview.viewer.role === "admin" || overview.viewer.role === "sub-admin") && (
              <Link
                href="/dashboard/users"
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-5 hover:border-gray-300 hover:shadow-sm"
              >
                <span>
                  <span className="block text-sm font-semibold text-gray-950">사용자 관리</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    총 {formatNumber(overview.stats.usersTotal)}명
                  </span>
                </span>
                <Users className="h-5 w-5 text-gray-500" />
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
