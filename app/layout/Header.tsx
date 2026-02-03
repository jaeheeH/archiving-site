"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 유저 정보 타입 정의
type UserProfile = {
  id: string;
  email?: string;
  nickname: string;
  avatar_url: string | null;
};

export default function Header() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  
  const supabase = createClient();

  // 헤더 제외 페이지
  const NO_HEADER_ROUTES = ["/login", "/signup", "/dashboard"];
  
  const showHeader = !NO_HEADER_ROUTES.some(route => pathname.startsWith(route));

  // 초기화 및 데이터 로드
  useEffect(() => {
    setMounted(true);
    
    // 1. 다크모드 설정
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDarkMode = savedTheme === "dark" || (savedTheme === null && prefersDark);
    
    setIsDark(isDarkMode);
    applyTheme(isDarkMode);

    // 2. 유저 정보 조회 (Auth + DB 최신 데이터)
    const fetchUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser) {
        const { data: dbUser, error } = await supabase
          .from("users")
          .select("nickname, avatar_url")
          .eq("id", authUser.id)
          .single();

        if (dbUser && !error) {
          setUserInfo({
            id: authUser.id,
            email: authUser.email,
            nickname: dbUser.nickname || authUser.user_metadata.nickname,
            avatar_url: dbUser.avatar_url || authUser.user_metadata.avatar_url,
          });
        } else {
          setUserInfo({
            id: authUser.id,
            email: authUser.email,
            nickname: authUser.user_metadata.nickname,
            avatar_url: authUser.user_metadata.avatar_url,
          });
        }
      } else {
        setUserInfo(null);
      }
    };

    fetchUser();
  }, []);

  // 다크모드 적용
  const applyTheme = (dark: boolean) => {
    const html = document.documentElement;
    if (dark) {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);
    applyTheme(newDarkMode);
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
    { label: "My", href: userInfo ? "/mypage" : "/login", icon: "ri-user-line", activeIcon: "ri-user-fill" },
  ];

  // 현재 경로에서 활성 메뉴 판단
  const isActive = (href: string) => {
    if (href === "/" && pathname !== "/") return false;
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  };

  if (!mounted) return null;

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
              <Link href="/mypage" className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden border border-gray-200 dark:border-gray-700">
                  {userInfo.avatar_url ? (
                    <img 
                      src={userInfo.avatar_url} 
                      alt={userInfo.nickname} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-bold bg-gray-100 dark:bg-gray-800 dark:text-gray-300">
                      {userInfo.nickname?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                </div>
              </Link>
            ) : (
              <Link 
                href="/login" 
                className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white"
              >
                Login
              </Link>
            )}

            {/* 다크모드 토글 버튼
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={isDark ? "라이트 모드" : "다크 모드"}
            >
              <i className={`text-lg ${isDark ? "ri-sun-line text-yellow-400" : "ri-moon-line text-gray-600"}`}></i>
            </button> */}
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