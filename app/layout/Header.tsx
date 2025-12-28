"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  // 헤더 제외 페이지
  const NO_HEADER_ROUTES = ["/login", "/signup", "/dashboard"];
  
  const showHeader = !NO_HEADER_ROUTES.some(route => pathname.startsWith(route));

  if (!showHeader) return null;

  // 메뉴 설정
  const menuItems = [
    { label: "Gallery", href: "/gallery" },
    { label: "Blog", href: "/blog" },
    { label: "Archive", href: "/archive" },
  ];

  // 현재 경로에서 활성 메뉴 판단
  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="client-header sticky top-0 z-10">
      <div className="contents">
        <div className="client-header-left">
          <Link href="/" className="client-header-logo">
            Archiving
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
        </nav>
      </div>
    </header>
  );
}