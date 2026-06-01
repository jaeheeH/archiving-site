"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BookmarkCheck,
  FileCog,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { normalizeAvatarUrl } from "@/lib/avatar-url";

const TAB_CONFIG = [
  { id: "home", label: "홈", href: "/mypage", icon: LayoutDashboard },
  { id: "profile", label: "내 정보", href: "/mypage/profile", icon: UserRound },
  { id: "activity", label: "내 활동", href: "/mypage/activity", icon: BookmarkCheck },
  { id: "account", label: "계정 설정", href: "/mypage/account", icon: ShieldCheck },
] as const;

type Viewer = {
  email?: string;
  nickname: string;
  avatar_url: string | null;
  role: string;
};

function getManagementLink(role?: string | null) {
  if (role === "admin" || role === "sub-admin") {
    return { id: "dashboard", label: "대시보드", href: "/dashboard", icon: LayoutDashboard };
  }

  if (role === "editor") {
    return { id: "cms", label: "CMS", href: "/dashboard/contents", icon: FileCog };
  }

  return null;
}

export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const managementLink = getManagementLink(viewer?.role);
  const tabs = managementLink ? [...TAB_CONFIG, managementLink] : TAB_CONFIG;

  useEffect(() => {
    const fetchViewer = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authUser = session?.user;

      if (!authUser) {
        setViewer(null);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("nickname, email, avatar_url, role")
        .eq("id", authUser.id)
        .maybeSingle();

      setViewer({
        email: data?.email || authUser.email,
        nickname:
          data?.nickname ||
          authUser.user_metadata?.nickname ||
          authUser.user_metadata?.name ||
          authUser.email?.split("@")[0] ||
          "사용자",
        avatar_url: normalizeAvatarUrl(data?.avatar_url || authUser.user_metadata?.avatar_url),
        role: data?.role || "user",
      });
    };

    fetchViewer();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="archive-page-shell min-h-screen bg-[var(--archive-canvas)] text-[var(--archive-ink)]">
      <section className="border-b border-[var(--archive-line)]">
        <div className="mx-auto max-w-[var(--archive-page)] px-4 pb-8 pt-14">
          <p className="archive-eyebrow mb-3 text-[var(--archive-faint)]">Account</p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">마이페이지</h1>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-b border-[var(--archive-line)] bg-[var(--archive-canvas)]/95 backdrop-blur lg:hidden">
        <div className="mx-auto max-w-[var(--archive-page)] px-4">
          <nav className="flex gap-6 overflow-x-auto py-4">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`inline-flex h-8 shrink-0 items-center gap-2 border-b-2 text-[13px] font-medium transition-colors ${
                    isActive
                      ? "border-[var(--archive-ink)] text-[var(--archive-ink)]"
                      : "border-transparent text-[var(--archive-muted)] hover:text-[var(--archive-brand)]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      <div className="mx-auto grid min-h-[60vh] max-w-[var(--archive-page)] gap-10 px-4 py-10 lg:grid-cols-[220px_1fr] lg:py-12">
        <aside className="hidden lg:block">
          <nav className="sticky top-28">
            {viewer && (
              <div className="mb-7 flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-100">
                  {viewer.avatar_url ? (
                    <img src={viewer.avatar_url} alt={viewer.nickname} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-gray-500">
                      {viewer.nickname.charAt(0) || "U"}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-950">{viewer.nickname}</p>
                  <p className="truncate text-xs text-[var(--archive-muted)]">{viewer.email}</p>
                </div>
              </div>
            )}

            <MenuGroup label="내 공간">
              {TAB_CONFIG.slice(0, 3).map((tab) => {
                const isActive = pathname === tab.href;
                const Icon = tab.icon;

                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={`inline-flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-gray-100 text-[var(--archive-ink)]"
                        : "text-[var(--archive-muted)] hover:bg-[#ff4800]/10 hover:text-[#ff4800]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {tab.label}
                  </Link>
                );
              })}
            </MenuGroup>

            <MenuGroup label="계정">
              <MenuLink
                href="/mypage/account"
                label="계정 설정"
                icon={ShieldCheck}
                active={pathname === "/mypage/account"}
              />
            </MenuGroup>

            {managementLink && (
              <MenuGroup label="관리">
                <MenuLink
                  href={managementLink.href}
                  label={managementLink.label}
                  icon={managementLink.icon}
                  active={pathname === managementLink.href}
                />
              </MenuGroup>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="mt-4 inline-flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-[var(--archive-muted)] transition-colors hover:bg-[#ff4800]/10 hover:text-[#ff4800]"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              로그아웃
            </button>
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="archive-eyebrow mb-3 text-[var(--archive-faint)]">{label}</p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function MenuLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors ${
        active
          ? "bg-gray-100 text-[var(--archive-ink)]"
          : "text-[var(--archive-muted)] hover:bg-[#ff4800]/10 hover:text-[#ff4800]"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
