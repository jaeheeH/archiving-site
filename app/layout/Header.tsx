"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 헤더 제외 페이지
  const NO_HEADER_ROUTES = ["/login", "/signup", "/dashboard"];
  
  const showHeader = !NO_HEADER_ROUTES.some(route => pathname.startsWith(route));

  // 다크모드 초기화 및 감지
  useEffect(() => {
    setMounted(true);
    
    // localStorage에서 다크모드 설정 가져오기
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDarkMode = savedTheme === "dark" || (savedTheme === null && prefersDark);
    
    setIsDark(isDarkMode);
    applyTheme(isDarkMode);
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

  // 다크모드 토글
  const toggleDarkMode = () => {
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);
    applyTheme(newDarkMode);
  };

  if (!showHeader) return null;

  // 메뉴 설정
  const menuItems = [
    { label: "Gallery", href: "/gallery" },
    { label: "Blog", href: "/blog" },
    { label: "Reference", href: "/references" },
  ];

  // 현재 경로에서 활성 메뉴 판단
  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  if (!mounted) return null;

  return (
    <header className="client-header sticky top-0 z-10">
      <div className="contents">
        <meta name="p:domain_verify" content="a1385cca1b4c87b9e9f53b214e8fd264"/>
        <div className="client-header-left">
          <Link href="/" className="client-header-logo flex gap-4">
            <img src="/logo.png" alt="" className="h-4" />
          </Link>

          <div className="client-header-search"></div>
        </div>

        <nav className="client-header-menu">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`client-header-menu-item ${
                isActive(item.href) ? "active" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}

          {/* 다크모드 토글 버튼 */}
          <button
            onClick={toggleDarkMode}
            className="client-header-dark-toggle"
            title={isDark ? "라이트 모드" : "다크 모드"}
            aria-label="다크모드 토글"
          >
            {isDark ? (
              <i className="ri-sun-line"></i>
            ) : (
              <i className="ri-moon-line"></i>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}