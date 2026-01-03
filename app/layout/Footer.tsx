"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  // 푸터 제외 페이지 (로그인, 회원가입, 대시보드 등)
  const NO_FOOTER_ROUTES = ["/login", "/signup", "/dashboard", "/admin"];
  
  // 현재 경로가 제외 경로로 시작하는지 확인
  const showFooter = !NO_FOOTER_ROUTES.some((route) => pathname.startsWith(route));

  if (!showFooter) return null;

  return (
    <footer className="border-t border-gray-100 bg-white pt-16 pb-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-0">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8 mb-16">
          
          {/* 1. 브랜드 정보 (좌측 - 5칸 차지) */}
          <div className="md:col-span-5 space-y-6">
            <Link href="/" className="inline-block">
              <img src="/logo.png" alt="ARCH-B Logo" className="h-5 w-auto" />
            </Link>
            <div className="space-y-4">
              <p className="text-gray-500 text-sm leading-relaxed max-w-sm">
                <strong>ARCHIVING THE BEHIND.</strong><br />
                결과물의 이면을 기록합니다.<br />
                디자인 영감부터 코드 조각까지, 크리에이터를 위한 구조화된 데이터베이스입니다.
              </p>
            </div>
          </div>

          {/* 2. 사이트맵 (중간 - 3칸 차지) */}
          <div className="md:col-span-3">
            <h4 className="font-bold text-gray-900 mb-6 text-sm uppercase tracking-wider">Explore</h4>
            <ul className="space-y-4 text-sm text-gray-500">
              <li>
                <Link href="/gallery" className="hover:text-black transition-colors">
                  Gallery
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-black transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-black transition-colors">
                  Archive
                </Link>
              </li>
            </ul>
          </div>

          {/* 3. 연락처 및 소셜 (우측 - 4칸 차지) */}
          <div className="md:col-span-4">
            <h4 className="font-bold text-gray-900 mb-6 text-sm uppercase tracking-wider">Connect</h4>
            <ul className="space-y-4 text-sm text-gray-500">
              <li className="flex items-center gap-2">
                <i className="ri-mail-line text-lg"></i>
                <a href="mailto:contact@archbehind.com" className="hover:text-black transition-colors">
                  contact@archbehind.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <i className="ri-github-fill text-lg"></i>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">
                  GitHub Repository
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 하단 저작권 영역 */}
        <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-400 font-mono">
          <p>&copy; {new Date().getFullYear()} ARCH-B. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}