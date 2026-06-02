"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import "../css/sideBar.scss";

export default function Sidebar() {
  const pathname = usePathname();

  const menu = [
    {
      label: "대시보드",
      icon: "ri-dashboard-line",
      href: "/dashboard",
      children: [],
    },
    {
      label: "콘텐츠 관리",
      icon: "ri-edit-2-line",
      href: "/dashboard/contents",
      children: [
        { label: "콘텐츠 개요", href: "/dashboard/contents" },
        { label: "갤러리", href: "/dashboard/contents/gallery" },
        { label: "블로그", href: "/dashboard/contents/blog" },
        { label: "레퍼런스", href: "/dashboard/contents/references" },
      ],
    },
    {
      label: "AI 작업공간",
      icon: "ri-sparkling-line",
      href: "/dashboard/studio",
      children: [
        { label: "브랜드 관리", href: "/dashboard/brand" },
        { label: "브랜드 만들기", href: "/dashboard/brand-kit" },
        { label: "Studio", href: "/dashboard/studio" },
        { label: "Library", href: "/dashboard/library" },
      ],
    },
    {
      label: "통계",
      icon: "ri-line-chart-line",
      href: "/dashboard/analytics",
      children: [
        { label: "통계 개요", href: "/dashboard/analytics" },
        { label: "블로그", href: "/dashboard/analytics/blog" },
        { label: "갤러리", href: "/dashboard/analytics/gallery" },
        { label: "레퍼런스", href: "/dashboard/analytics/references" },
      ],
    },
    {
      label: "사용자 관리",
      icon: "ri-user-line",
      href: "/dashboard/users",
      children: [],
    },
    {
      label: "환경설정",
      icon: "ri-settings-2-line",
      href: "/dashboard/settings",
      children: [
        { label: "설정 개요", href: "/dashboard/settings" },
        { label: "SEO(검색엔진최적화)", href: "/dashboard/settings/seo" },
        { label: "메인 배너", href: "/dashboard/settings/banner" },
      ],
    }
  ];

  const [openMenu, setOpenMenu] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  //
  // 자동 open (최초 1회만)
  //
  useEffect(() => {
    // 경로 변경 시: 먼저 메뉴 초기화
    let opened = "";

    // 현재 pathname 에 맞는 부모 메뉴 찾기
    menu.forEach((m) => {
      if (m.children?.some((child) => pathname.startsWith(child.href))) {
        opened = m.label;
      } else if (pathname === m.href) {
        opened = m.label;
      }
    });

    // pathname 변경에 맞춰 열려 있어야 할 섹션을 동기화합니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenMenu(opened);
  }, [pathname]);

  useEffect(() => {
    queueMicrotask(() => setMobileMenuOpen(false));
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const currentMenuLabel =
    menu.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))?.label ||
    "대시보드";

  const renderMenu = (mode: "desktop" | "mobile") => (
    <nav className="flex flex-col gap-2 px-3">
      {menu.map((item) => {
        const isParentActive =
          pathname === item.href ||
          pathname.startsWith(item.href + "/");
        const isOpen = openMenu === item.label;

        return (
          <div key={`${mode}-${item.label}`}>
            {item.children.length === 0 ? (
              <Link
                href={item.href}
                className={`
                  flex items-center justify-between rounded-md text-sm
                  ${
                    pathname === item.href
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }
                `}
              >
                <div className="flex items-center gap-1">
                  <div className="nav-menu-icon">
                    <i className={`${item.icon} ${ pathname === item.href ? "text-blue-600" : "text-gray-600" }`} />
                  </div>
                  <span>{item.label}</span>
                </div>
              </Link>
            ) : (
              <div
                onClick={() => {
                  setOpenMenu(isOpen ? "" : item.label);
                }}
                className={`
                  flex items-center justify-between cursor-pointer rounded-md text-sm
                  ${
                    isParentActive
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }
                `}
              >
                <div className="flex items-center gap-1">
                  <div className="nav-menu-icon">
                    <i className={`${item.icon} ${ isParentActive ? "text-blue-600" : "text-gray-600" }`} />
                  </div>
                  <span>{item.label}</span>
                </div>

                <div className={`menu-arrow ${ isOpen ? "rotate-180" : "" }`}>
                  <i className="ri-arrow-down-s-line" />
                </div>
              </div>
            )}

            {isOpen && item.children.length > 0 && (
              <div className="mt-1 flex flex-col gap-1">
                {item.children.map((child) => {
                  const activeChild = pathname === child.href;

                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`
                        block rounded-md px-10 py-2 text-sm
                        ${
                          activeChild
                            ? "bg-gray-100 text-gray-700 font-semibold"
                            : "text-gray-700 hover:bg-gray-200"
                        }
                      `}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
    <div className="dashboard-mobile-bar border-b bg-white lg:hidden">
      <button
        type="button"
        onClick={() => setMobileMenuOpen(true)}
        className="dashboard-mobile-menu-button"
        aria-label="대시보드 메뉴 열기"
        aria-expanded={mobileMenuOpen}
      >
        <i className="ri-menu-line" />
      </button>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Archiving</p>
        <p className="truncate text-sm font-semibold text-gray-950">{currentMenuLabel}</p>
      </div>
      <Link
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="dashboard-mobile-site-link"
        aria-label="사이트 바로가기"
      >
        <i className="ri-external-link-line" />
      </Link>
    </div>

    {mobileMenuOpen && (
      <div className="dashboard-mobile-drawer lg:hidden">
        <button
          type="button"
          aria-label="대시보드 메뉴 닫기"
          className="dashboard-mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
        <aside className="dashboard-mobile-panel">
          <div className="side-logo">
            <p>Archiving</p>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="dashboard-mobile-close"
              aria-label="대시보드 메뉴 닫기"
            >
              <i className="ri-close-line" />
            </button>
          </div>

          <div className="nav-section">
            <nav className="flex flex-col gap-2 px-3">
              <div className="text-gray-700 hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center justify-between rounded-md text-sm">
                  <div className="flex items-center gap-1">
                    <div className="nav-menu-icon">
                      <i className="ri-notification-3-line" />
                    </div>
                    <span>알림</span>
                  </div>
                </div>
              </div>
              <div>
                <Link className="flex items-center justify-between rounded-md text-sm text-gray-700 hover:bg-gray-50" href="/" target="_blank" rel="noopener noreferrer">
                  <div className="flex items-center gap-1">
                    <div className="nav-menu-icon">
                      <i className="ri-external-link-line" />
                    </div>
                    <span>사이트 바로가기</span>
                  </div>
                </Link>
              </div>
            </nav>
          </div>

          <div className="nav-section">
            <div className="nav-title"><span>사이트 관리</span></div>
            {renderMenu("mobile")}
          </div>
        </aside>
      </div>
    )}

    <aside className="border-r bg-white flex flex-col" id="sideBar">
      <div className="side-logo"><p>Archiving</p></div>

      <div className="nav-section">
        <nav className="flex flex-col gap-2 px-3">
          <div className="text-gray-700 hover:bg-gray-50 cursor-pointer">
            <div  className="flex items-center justify-between  rounded-md text-sm">
              <div className="flex items-center gap-1">
                <div className="nav-menu-icon">
                  <i className="ri-notification-3-line" />
                </div>
                <span>알림</span>
              </div>
            </div>
          </div>
          <div>
            <Link  className="flex items-center justify-between text-gray-700 hover:bg-gray-50 rounded-md text-sm" href="/" target="_blank" rel="noopener noreferrer">
              <div className="flex items-center gap-1 ">
                <div className="nav-menu-icon">
                  <i className="ri-external-link-line" />
                </div>
                <span>사이트 바로가기</span>
              </div>
            </Link>
          </div>
        </nav>
      </div>
      <div className="nav-section">
        <div className="nav-title"><span>사이트 관리</span></div>
        {renderMenu("desktop")}
      </div>
    </aside>
    </>
  );
}
