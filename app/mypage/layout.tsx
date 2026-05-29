"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookmarkCheck, ShieldCheck, UserRound } from "lucide-react";

const TAB_CONFIG = [
  { id: "profile", label: "내 정보", href: "/mypage/profile", icon: UserRound },
  { id: "activity", label: "내 활동", href: "/mypage/activity", icon: BookmarkCheck },
  { id: "account", label: "계정 설정", href: "/mypage/account", icon: ShieldCheck },
] as const;

export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto min-h-[80vh] max-w-5xl px-5 py-10 md:px-6 md:py-12">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">My Page</p>
        <h1 className="mt-2 text-3xl font-semibold text-gray-950">마이페이지</h1>
      </header>

      <div className="flex flex-col gap-8 md:flex-row">
        <aside className="w-full shrink-0 md:w-60">
          <nav className="grid grid-cols-3 gap-1 rounded-lg border border-gray-200 bg-white p-1 md:flex md:flex-col">
            {TAB_CONFIG.map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors md:justify-start ${
                    isActive
                      ? "bg-gray-950 text-white"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
