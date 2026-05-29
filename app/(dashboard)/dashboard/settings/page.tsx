import Link from "next/link";
import { ArrowRight, ImageIcon, Search, Tags } from "lucide-react";

export const dynamic = "force-dynamic";

export default function SettingsIndexPage() {
  const sections = [
    {
      title: "SEO 설정",
      description: "사이트 제목, 설명, 오픈그래프, 검색엔진 인증값을 관리합니다.",
      href: "/dashboard/settings/seo",
      icon: Search,
    },
    {
      title: "메인 배너",
      description: "홈 화면에 노출되는 배너 이미지와 링크를 정리합니다.",
      href: "/dashboard/settings/banner",
      icon: ImageIcon,
    },
    {
      title: "레퍼런스 카테고리",
      description: "레퍼런스 분류 체계를 만들고 표시 순서를 관리합니다.",
      href: "/dashboard/settings/reference-categories",
      icon: Tags,
    },
  ];

  return (
    <div>
      <header className="dashboard-Header">
        <div>
          <h1>환경설정</h1>
          <p className="mt-1 text-xs text-gray-500">
            사이트 운영에 필요한 공개 설정을 한 곳에서 관리합니다.
          </p>
        </div>
      </header>

      <main className="dashboard-container">
        <section className="grid gap-4 lg:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <Link
                key={section.title}
                href={section.href}
                className="rounded-lg border border-gray-200 bg-white p-5 transition hover:border-gray-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
                <h2 className="mt-5 text-base font-semibold text-gray-950">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">{section.description}</p>
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}
