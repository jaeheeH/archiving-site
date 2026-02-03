"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const TAB_CONFIG = [
  { id: "profile", label: "내 정보", href: "/mypage/profile" },
  { id: "activity", label: "내 활동", href: "/mypage/activity" },
  { id: "account", label: "계정 설정", href: "/mypage/account" },
] as const;

export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="max-w-5xl mx-auto py-12 px-6 min-h-[80vh]">
      <h1 className="text-3xl font-bold mb-8">마이페이지</h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* 왼쪽: 사이드 탭 메뉴 */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <nav className="flex md:flex-col gap-1">
            {TAB_CONFIG.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`flex-1 md:flex-none text-left px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gray-100 text-black"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* 오른쪽: 콘텐츠 영역 */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
