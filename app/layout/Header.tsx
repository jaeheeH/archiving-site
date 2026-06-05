"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeAvatarUrl } from "@/lib/avatar-url";

// 유저 정보 타입 정의
type UserProfile = {
  id: string;
  email?: string;
  nickname: string;
  avatar_url: string | null;
  role: string;
};

const THEME_CHANGE_EVENT = "arch-theme-change";

function readPreferredDarkMode() {
  if (typeof window === "undefined") return false;

  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return savedTheme === "dark" || (savedTheme === null && prefersDark);
}

function subscribeToTheme(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleStorage = (event: StorageEvent) => {
    if (event.key === "theme") onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  mediaQuery.addEventListener("change", onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    mediaQuery.removeEventListener("change", onStoreChange);
  };
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isDark = useSyncExternalStore(subscribeToTheme, readPreferredDarkMode, () => false);
  const [mounted, setMounted] = useState(false);
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  
  const supabase = useMemo(() => createClient(), []);

  // 헤더 제외 페이지
  const NO_HEADER_ROUTES = ["/login", "/signup", "/dashboard"];
  
  const showHeader = !NO_HEADER_ROUTES.some(route => pathname.startsWith(route));

  // 다크모드 적용
  const applyTheme = useCallback((dark: boolean, persist = true) => {
    const html = document.documentElement;
    if (dark) {
      html.classList.add("dark");
      if (persist) localStorage.setItem("theme", "dark");
    } else {
      html.classList.remove("dark");
      if (persist) localStorage.setItem("theme", "light");
    }
  }, []);

  // 초기화 및 데이터 로드
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    applyTheme(isDark, false);
  }, [applyTheme, isDark]);

  useEffect(() => {
    // 유저 정보 조회 (Auth + DB 최신 데이터)
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;

      if (authUser) {
        const { data: dbUser, error } = await supabase
          .from("users")
          .select("nickname, email, avatar_url, role")
          .eq("id", authUser.id)
          .single();

        if (dbUser && !error) {
          setUserInfo({
            id: authUser.id,
            email: dbUser.email || authUser.email,
            nickname: dbUser.nickname || authUser.user_metadata.nickname,
            avatar_url: normalizeAvatarUrl(dbUser.avatar_url || authUser.user_metadata.avatar_url),
            role: dbUser.role || "user",
          });
        } else {
          setUserInfo({
            id: authUser.id,
            email: authUser.email,
            nickname: authUser.user_metadata.nickname,
            avatar_url: normalizeAvatarUrl(authUser.user_metadata.avatar_url),
            role: "user",
          });
        }
      } else {
        setUserInfo(null);
      }
    };

    fetchUser();
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => setProfileMenuOpen(false));
  }, [pathname]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDark;
    applyTheme(newDarkMode);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserInfo(null);
    setProfileMenuOpen(false);
    router.replace("/");
    router.refresh();
  };

  const getManagementLink = (role?: string | null) => {
    if (role === "admin" || role === "sub-admin") {
      return { label: "대시보드", href: "/dashboard", icon: "ri-dashboard-line" };
    }

    if (role === "editor") {
      return { label: "CMS", href: "/dashboard/contents", icon: "ri-file-list-3-line" };
    }

    return null;
  };

  if (!showHeader) return null;

  // 데스크탑용 메뉴 설정
  const menuItems = [
    { label: "Gallery", href: "/gallery" },
    { label: "Blog", href: "/blog" },
    { label: "Reference", href: "/references" },
  ];

  // 모바일 하단바용 메뉴 설정 (아이콘 포함)
  const mobileMenuItems = [
    { label: "Home", href: "/", icon: "ri-home-5-line", activeIcon: "ri-home-5-fill" },
    { label: "Gallery", href: "/gallery", icon: "ri-image-line", activeIcon: "ri-image-fill" },
    { label: "Blog", href: "/blog", icon: "ri-article-line", activeIcon: "ri-article-fill" },
    { label: "Reference", href: "/references", icon: "ri-bookmark-line", activeIcon: "ri-bookmark-fill" },
    { label: "My", href: userInfo ? "/mypage" : "/login?redirect=/mypage", icon: "ri-user-line", activeIcon: "ri-user-fill" },
  ];

  // 현재 경로에서 활성 메뉴 판단
  const isActive = (href: string) => {
    if (href === "/" && pathname !== "/") return false;
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  };

  if (!mounted) return null;

  const managementLink = getManagementLink(userInfo?.role);
  const loginHref =
    pathname && pathname !== "/" && !pathname.startsWith("/login")
      ? `/login?redirect=${encodeURIComponent(pathname)}`
      : "/login";

  return (
    <>
      {/* === Desktop & Common Top Header === */}
      <header className="client-header sticky top-0 z-40 bg-white/80 dark:bg-[#121212]/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-colors duration-300">
        <div className="contents max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

          <div className="client-header-left flex items-center">
            <Link href="/" className="client-header-logo flex gap-4 mr-6">
              {/* 로고: 다크모드 대응 필요시 이미지 교체 로직 추가 권장 */}
              <img src={isDark ? "/logo_white.png" : "/logo.png"} alt="Logo" className="h-5 w-auto" />
            </Link>

            <div className="client-header-search hidden sm:block">
              {/* 검색창 플레이스홀더 */}
            </div>
          </div>

          {/* Desktop Navigation (모바일에서 숨김: hidden md:flex) */}
          <nav className="client-header-menu md:flex items-center gap-6">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm  font-medium transition-colors ${
                  isActive(item.href) 
                    ? "active" 
                    : "dark:hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}


            {/* 유저 프로필 영역 */}
            {userInfo ? (
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-gray-50 dark:hover:bg-gray-800"
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                >
                  <span className="h-8 w-8 overflow-hidden rounded-full border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                    {userInfo.avatar_url ? (
                      <img
                        src={userInfo.avatar_url}
                        alt={userInfo.nickname}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-300">
                        {userInfo.nickname?.charAt(0).toUpperCase() || "U"}
                      </span>
                    )}
                  </span>
                  <span className="hidden max-w-24 truncate text-sm font-semibold text-gray-900 dark:text-gray-100 lg:block">
                    {userInfo.nickname || "사용자"}
                  </span>
                  <i className="ri-arrow-down-s-line text-lg text-gray-500" />
                </button>

                {profileMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-800 dark:bg-[#161616]"
                  >
                    <div className="mb-3 flex items-center gap-3 px-2 py-2">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        {userInfo.avatar_url ? (
                          <img src={userInfo.avatar_url} alt={userInfo.nickname} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-gray-500 dark:text-gray-300">
                            {userInfo.nickname?.charAt(0).toUpperCase() || "U"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-950 dark:text-gray-50">
                          {userInfo.nickname || "사용자"}
                        </p>
                        <p className="truncate text-sm text-gray-500">{userInfo.email}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <UserMenuLink href="/mypage" icon="ri-user-line" label="내 프로필" />
                      <UserMenuLink href="/mypage/activity" icon="ri-bookmark-line" label="내 활동" />
                      <UserMenuLink href="/mypage/account" icon="ri-settings-3-line" label="설정" />
                      <button
                        type="button"
                        onClick={toggleDarkMode}
                        className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-[#ff4800]/10 hover:text-[#ff4800] dark:text-gray-200"
                      >
                        <span className="flex items-center gap-3">
                          <i className={`${isDark ? "ri-sun-line text-yellow-400" : "ri-moon-line"} text-lg`} />
                          {isDark ? "라이트 모드" : "다크 모드"}
                        </span>
                        <span className="text-xs font-semibold text-gray-400">{isDark ? "ON" : "OFF"}</span>
                      </button>
                    </div>

                    {managementLink && (
                      <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                        <UserMenuLink
                          href={managementLink.href}
                          icon={managementLink.icon}
                          label={managementLink.label}
                        />
                      </div>
                    )}

                    <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-[#ff4800]/10 hover:text-[#ff4800] dark:text-gray-200"
                      >
                        <i className="ri-logout-box-r-line text-lg" />
                        로그아웃
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link 
                href={loginHref}
                className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white"
              >
                Login
              </Link>
            )}

          </nav>



        </div>
      </header>

      {/* === Mobile Bottom Navigation Bar === */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#121212] border-t border-gray-200 dark:border-gray-800 md:hidden pb-[env(safe-area-inset-bottom)] transition-colors duration-300">
        <div className="flex justify-around items-center h-16 px-2">
          {mobileMenuItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center w-full h-full space-y-1"
              >
                <i 
                  className={`text-2xl ${active ? item.activeIcon : item.icon} ${
                    active ? "text-black dark:text-white" : "text-gray-400 dark:text-gray-500"
                  }`}
                ></i>
                <span 
                  className={`text-[10px] ${
                    active ? "text-black dark:text-white font-medium" : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function UserMenuLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-[#ff4800]/10 hover:text-[#ff4800] dark:text-gray-200"
    >
      <i className={`${icon} text-lg`} />
      {label}
    </Link>
  );
}
