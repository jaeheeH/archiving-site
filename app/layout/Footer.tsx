"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header() {
  const pathname = usePathname();


  // 헤더 제외 페이지
  const NO_FOOTER_ROUTES = ["/login", "/signup", "/dashboard"];
  
  const showFooter = !NO_FOOTER_ROUTES.some(route => pathname.startsWith(route));

  if (!showFooter) return null;




  return (
    <footer>

      <div className="contents">
        <div className="client-header-left">
          <Link href="/" className="client-header-logo flex gap-4">
            <img src="/logo.png" alt="" className="h-4" />
          </Link>
        </div>


      </div>
    </footer>
  );
}