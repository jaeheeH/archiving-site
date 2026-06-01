"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [isChecking, setIsChecking] = useState(true);

  const getSafeRedirectPath = useCallback(() => {
    const redirect = new URLSearchParams(window.location.search).get("redirect");
    if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) return "/";
    if (redirect === "/login" || redirect.startsWith("/auth/callback")) return "/";
    return redirect.includes("\n") || redirect.includes("\r") ? "/" : redirect;
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          router.push(getSafeRedirectPath()); // 이미 로그인되어 있으면 요청한 내부 경로로
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setIsChecking(false);
      }
    };
    checkAuth();
  }, [getSafeRedirectPath, router, supabase]);

  const loginWithGoogle = async () => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
      : location.origin;
    const next = encodeURIComponent(getSafeRedirectPath());
    const redirectUrl = `${siteUrl}/auth/callback?next=${next}`;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });
  };

  const loginWithKakao = async () => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
      : location.origin;
    const next = encodeURIComponent(getSafeRedirectPath());
    const redirectUrl = `${siteUrl}/auth/callback?next=${next}`;

    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: redirectUrl,
      },
    });
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold text-center mb-8">로그인</h1>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={loginWithGoogle}
            className="w-full bg-black text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-800 transition"
          >
            Google 로그인
          </button>
          <button
            onClick={loginWithKakao}
            className="w-full bg-[#FEE500] text-[#000000] px-4 py-3 rounded-lg font-medium hover:bg-[#FDD835] transition"
          >
            카카오 로그인
          </button>
        </div>
      </div>
    </div>
  );
}
