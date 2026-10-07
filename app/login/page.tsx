"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/client";
import { SITE_COPY } from "@/lib/site-copy";

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
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div role="status" className="flex items-center gap-3 text-sm font-semibold">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          로그인 상태를 확인하고 있습니다.
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-12 text-foreground">
      <section aria-labelledby="login-title" className="w-full max-w-[360px] text-center">
        <Link href="/" aria-label="ARCH.B 홈으로" className="inline-block text-[28px] font-extrabold tracking-[-0.04em]">
          {SITE_COPY.brand.name}
        </Link>

        <div className="mt-8">
          <h1 id="login-title" className="text-2xl font-bold tracking-[-0.03em]">로그인</h1>
          <p className="mt-2 text-sm leading-6 text-secondary">사용하던 계정으로 계속하세요.</p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={loginWithGoogle}
            className="relative flex h-12 w-full items-center justify-center rounded-md border border-border bg-background px-12 text-sm font-medium transition-colors hover:bg-muted"
          >
            <i aria-hidden="true" className="ri-google-fill absolute left-4 text-xl" />
            Google로 계속하기
          </button>
          <button
            type="button"
            onClick={loginWithKakao}
            className="relative flex h-12 w-full items-center justify-center rounded-md border border-border bg-background px-12 text-sm font-medium transition-colors hover:bg-muted"
          >
            <i aria-hidden="true" className="ri-kakao-talk-fill absolute left-4 text-xl" />
            카카오로 계속하기
          </button>
        </div>

        <p className="mt-6 break-keep text-xs leading-6 text-secondary">
          로그인하면{' '}
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">이용약관</Link>
          과{' '}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">개인정보 처리방침</Link>
          에 동의하게 됩니다.
        </p>

        <Link href="/" className="mt-8 inline-block text-sm text-secondary transition-colors hover:text-foreground">홈으로 돌아가기</Link>
      </section>
    </main>
  );
}
