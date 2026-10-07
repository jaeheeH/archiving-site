"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_COPY } from "@/lib/site-copy";
export default function Footer() {
  const pathname = usePathname();
  if (["/login", "/signup", "/dashboard", "/admin"].some(route => pathname.startsWith(route))) return null;
  return <footer className="editorial-footer">
    <div className="editorial-footer-top"><div><Link href="/" className="editorial-wordmark">ARCH.B</Link><p>{SITE_COPY.brand.statement}</p></div><nav aria-label="하단 메뉴"><Link href="/news/stories">뉴스</Link><Link href="/art">아트</Link><Link href="/artists">작가</Link><Link href="/references">참고사이트</Link></nav></div>
    <div className="editorial-footer-bottom"><span>© 2026 ARCH.B</span><div><a href="mailto:archbehind@gmail.com">문의</a><Link href="/privacy">개인정보 처리방침</Link><Link href="/terms">이용약관</Link></div></div>
  </footer>;
}
