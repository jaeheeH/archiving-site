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
        { label: "갤러리", href: "/dashboard/contents/gallery" },
        { label: "아카이빙", href: "/dashboard/contents/archive" },
        { label: "블로그", href: "/dashboard/contents/blog" },
      ],
    },
    {
      label: "통계",
      icon: "ri-line-chart-line",
      href: "/dashboard/analytics",
      children: [
        { label: "갤러리", href: "/dashboard/analytics/default" },
        { label: "아카이빙", href: "/dashboard/analytics/archive" },
        { label: "아이템3", href: "/dashboard/analytics/item3" },
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
      href: "/dashboard/setting",
      children: [
        { label: "SEO(검색엔진최적화)", href: "/dashboard/settings/seo" },
        { label: "아카이빙 카테고리 관리", href: "/dashboard/settings/archiving-categories" },
        { label: "약관", href: "/dashboard/setting/etc" },
      ],
    }
  ];

  const [openMenu, setOpenMenu] = useState("");

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

    setOpenMenu(opened);
  }, [pathname]);

  return (
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
            <Link  className="flex items-center justify-between text-gray-700 hover:bg-gray-50 rounded-md text-sm" href="/" target="_blank">
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
        <nav className="flex flex-col gap-2 px-3">
          {menu.map((item) => {
            //
            // 상위 메뉴 active 조건
            //
            const isParentActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");

            //
            // 열림 여부: 오직 openMenu 로만 결정
            //
            const isOpen = openMenu === item.label;

            return (
              <div key={item.label}>
                {/* -------------------- 상위 메뉴 -------------------- */}
                {item.children.length === 0 ? (
                  // -------------------- children 없는 경우 → 즉시 이동 --------------------
                  <Link
                    href={item.href}
                    className={`
                      flex items-center justify-between  rounded-md text-sm
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
                  // -------------------- children 있는 경우 → toggle --------------------
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
                      <div className="nav-menu-icon"><i className={`${item.icon}  ${ isParentActive ? "text-blue-600" : "text-gray-600" }`} /></div>
                      <span>{item.label}</span>
                    </div>

                    <div className={`menu-arrow ${ isOpen ? "rotate-180" : "" }`}>
                      <i className={`ri-arrow-down-s-line`} />
                    </div>
                  </div>
                )}

                {/* -------------------- 하위 메뉴 -------------------- */}
                {isOpen && item.children.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    {item.children.map((child) => {
                      const activeChild = pathname === child.href;

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`
                            block px-10 py-2 text-sm rounded-md 
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
      </div>
    </aside>
  );
}
