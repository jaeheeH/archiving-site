"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeAvatarUrl } from "@/lib/avatar-url";
import ColorModeToggle from '@/app/components/ColorModeToggle';
import ArchiveImage from '@/app/components/ArchiveImage';
import BrandLogo from '@/app/components/BrandLogo';
import { CATEGORIES } from '@/lib/news-categories';
import { newsListUrl } from '@/lib/news-list';

// 유저 정보 타입 정의
type UserProfile = {
  id: string;
  email?: string;
  nickname: string;
  avatar_url: string | null;
  role: string;
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  
  const supabase = useMemo(() => createClient(), []);

  // 헤더 제외 페이지
  const NO_HEADER_ROUTES = ["/login", "/signup", "/dashboard"];
  
  const showHeader = !NO_HEADER_ROUTES.some(route => pathname.startsWith(route));

  useEffect(() => {
    if (!showHeader) return;
    let active = true;
    let requestVersion = 0;
    // The menu is display-only; all privileged requests still validate server-side.
    const fetchUser = async () => {
      const version = ++requestVersion;
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;

      if (authUser) {
        const { data: dbUser, error } = await supabase
          .from("users")
          .select("nickname, email, avatar_url, role")
          .eq("id", authUser.id)
          .single();

        if (!active || version !== requestVersion) return;
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
      } else if (active && version === requestVersion) {
        setUserInfo(null);
      }
    };

    void fetchUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => { if (event !== 'INITIAL_SESSION') void fetchUser(); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [supabase, showHeader]);

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

  // 아카이브 메뉴
  const menuItems = [
    { label: "아트", href: "/art" },
    { label: "작가", href: "/artists" },
    { label: "참고사이트", href: "/references" },
  ];

  // 모바일 하단바용 메뉴 설정 (아이콘 포함)
  const mobileMenuItems = [
    { label: "뉴스", href: "/news/stories", icon: "ri-newspaper-line", activeIcon: "ri-newspaper-fill" },
    { label: "아트", href: "/art", icon: "ri-image-line", activeIcon: "ri-image-fill" },
    { label: "작가", href: "/artists", icon: "ri-brush-line", activeIcon: "ri-brush-fill" },
    { label: "사이트", href: "/references", icon: "ri-links-line", activeIcon: "ri-links-fill" },
    { label: "MY", href: userInfo ? "/mypage" : "/login?redirect=/mypage", icon: "ri-user-line", activeIcon: "ri-user-fill" },
  ];

  // 현재 경로에서 활성 메뉴 판단
  const isActive = (href: string) => {
    if (href === "/news/stories") return pathname === "/news/stories" || pathname.startsWith("/news/read/");
    return pathname === href || pathname.startsWith(`${href}/`);
  };


  const managementLink = getManagementLink(userInfo?.role);
  const loginHref =
    pathname && pathname !== "/" && !pathname.startsWith("/login")
      ? `/login?redirect=${encodeURIComponent(pathname)}`
      : "/login";

  return (
    <>
      {/* === Desktop & Common Top Header === */}
      <header className="client-header editorial-header sticky top-0 z-40 bg-white/95 backdrop-blur-md">
        <div className="client-header-frame mx-auto flex max-w-[1280px] items-center">
          <div className="client-header-left flex items-center">
            <Link href="/" className="client-header-logo flex shrink-0 items-center">
              <BrandLogo />
            </Link>
          </div>

          <div className="editorial-header-actions">
            <ColorModeToggle />
            <Suspense fallback={null}><SiteSearch /></Suspense>
          </div>

            <div className="client-header-account flex max-w-[144px] justify-end">
            {userInfo ? (
              <div ref={profileMenuRef} className="relative" onKeyDown={event => {
                if (event.key === 'Escape') {
                  setProfileMenuOpen(false);
                  profileMenuRef.current?.querySelector('button')?.focus();
                }
              }}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  className="editorial-account-trigger flex max-w-full items-center gap-2 rounded-md py-1 pl-1 pr-2 transition hover:bg-muted"
                  aria-label="계정 메뉴"
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                  aria-controls="header-account-menu"
                >
                  <span className="h-8 w-8 overflow-hidden rounded-full border border-border bg-muted">
                    {userInfo.avatar_url ? (
                      <ArchiveImage width={32} height={32} sizes="32px"
                        src={userInfo.avatar_url}
                        alt={userInfo.nickname}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-bold text-secondary">
                        {userInfo.nickname?.charAt(0).toUpperCase() || "U"}
                      </span>
                    )}
                  </span>
                  <span className="hidden max-w-24 truncate text-sm font-semibold text-foreground lg:block">
                    {userInfo.nickname || "사용자"}
                  </span>
                  <i className="ri-arrow-down-s-line text-lg text-secondary" aria-hidden="true" />
                </button>

                {profileMenuOpen && (
                  <div
                    id="header-account-menu"
                    role="menu"
                    className="editorial-account-popup absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-lg border border-border bg-background p-3 shadow-none"
                  >
                    <div className="mb-3 flex items-center gap-3 px-2 py-2">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-muted">
                        {userInfo.avatar_url ? (
                          <ArchiveImage width={48} height={48} sizes="48px" src={userInfo.avatar_url} alt={userInfo.nickname} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-secondary">
                            {userInfo.nickname?.charAt(0).toUpperCase() || "U"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">
                          {userInfo.nickname || "사용자"}
                        </p>
                        <p className="truncate text-sm text-secondary">{userInfo.email}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <UserMenuLink href="/mypage" icon="ri-user-line" label="내 프로필" />
                      <UserMenuLink href="/mypage/activity" icon="ri-bookmark-line" label="내 활동" />
                      <UserMenuLink href="/mypage/account" icon="ri-settings-3-line" label="설정" />
                    </div>

                    {managementLink && (
                      <div className="mt-3 border-t border-border pt-3">
                        <UserMenuLink
                          href={managementLink.href}
                          icon={managementLink.icon}
                          label={managementLink.label}
                        />
                      </div>
                    )}

                    <div className="mt-3 border-t border-border pt-3">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-secondary transition hover:bg-muted hover:text-foreground"
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
                className="text-[12px] font-bold hover:text-foreground"
              >
                로그인
              </Link>
            )}
            </div>

        </div>
        <div className="editorial-nav-row">
          <div className="editorial-nav-frame">
            <Suspense fallback={null}><NewsNavigation /></Suspense>
            <nav className="editorial-archive-menu" aria-label="아카이브">
              {menuItems.map(item => <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}><span>{item.label}</span></Link>)}
            </nav>
          </div>
        </div>
      </header>

      {/* === Mobile Bottom Navigation Bar === */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex justify-around items-center h-16 px-2">
          {mobileMenuItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center justify-center w-full h-full space-y-1"
              >
                <i 
                  className={`text-2xl ${active ? item.activeIcon : item.icon} ${
                    active ? "text-foreground" : "text-secondary"
                  }`}
                ></i>
                <span 
                  className={`text-[10px] ${
                    active ? "text-foreground font-medium" : "text-secondary"
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

function NewsNavigation() {
  const pathname = usePathname();
  const params = useSearchParams();
  const listing = pathname === '/news/stories';
  const category = listing && Object.hasOwn(CATEGORIES, params.get('category') || '') ? params.get('category') : 'all';
  const inNews = listing || pathname.startsWith('/news/read/');
  const filters = listing ? { q: params.get('q') || '', source: params.get('source') || '', collection: params.get('collection') || '' } : {};
  return <nav className="editorial-news-menu" aria-label="뉴스 분야">
    {Object.entries({ all: '뉴스', ...CATEGORIES }).map(([key, label]) => <Link prefetch={false} key={key} href={newsListUrl({ ...filters, category: key })} aria-current={inNews && category === key ? 'page' : undefined}><span>{label}</span></Link>)}
  </nav>;
}

function SiteSearch() {
  const params = useSearchParams();
  const pathname = usePathname();
  const searchRef = useRef<HTMLDetailsElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = pathname === '/search' ? (params.get('q') || '').slice(0, 100) : '';
  const closeSearch = () => {
    if (!searchRef.current) return;
    searchRef.current.open = false;
    searchRef.current.querySelector('summary')?.focus();
  };

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const node = searchRef.current;
      if (node?.open && !node.contains(event.target as Node)) node.open = false;
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

  return <details
      key={`${pathname}?${params.toString()}`}
      ref={searchRef}
      className="editorial-search-control"
      onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeSearch(); } }}
    >
      <summary aria-label="통합 검색 열기" title="통합 검색" onClick={(event) => {
        event.preventDefault();
        if (!searchRef.current) return;
        if (searchRef.current.open) {
          closeSearch();
        } else {
          searchRef.current.open = true;
          inputRef.current?.focus();
        }
      }}><i className="ri-search-line" aria-hidden="true" /></summary>
      <div className="editorial-search-panel">
        <div className="editorial-search-heading">
          <label htmlFor="archb-search-query">통합 검색</label>
          <button type="button" onClick={closeSearch} aria-label="검색 닫기"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>
        <form role="search" aria-label="통합 검색" action="/search" method="get">
          <input ref={inputRef} id="archb-search-query" type="search" name="q" autoComplete="off" defaultValue={query} placeholder="뉴스·작품·작가 검색" maxLength={100} enterKeyHint="search" />
          <button type="submit">검색</button>
        </form>
      </div>
    </details>;
}

function UserMenuLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-secondary transition hover:bg-muted hover:text-foreground"
    >
      <i className={`${icon} text-lg`} />
      {label}
    </Link>
  );
}
