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
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          로그인 상태를 확인하고 있습니다.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 md:px-8 md:py-8">
        <Link href="/" className="w-fit text-sm font-black tracking-[-0.02em]">
          {SITE_COPY.brand.name}<span className="text-accent">.</span>
        </Link>

        <div className="grid flex-1 items-center gap-14 py-16 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-24">
          <section>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
              {SITE_COPY.brand.tagline}
            </p>
            <h1 className="max-w-3xl text-[clamp(2.75rem,7vw,6.75rem)] font-black leading-[0.94] tracking-[-0.06em]">
              다시 꺼내 볼 수 있도록,
              <br />
              영감을 기록하세요.
            </h1>
            <p className="mt-8 max-w-xl text-[15px] leading-7 text-secondary md:text-base">
              저장한 이미지와 글, 레퍼런스를 한곳에서 관리하고 다음 작업에 필요한 맥락을 이어가세요.
            </p>
          </section>

          <section className="border-t border-border pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">Sign in</p>
            <h2 className="mt-3 text-2xl font-bold">ARCH.B에 로그인</h2>
            <p className="mt-3 text-sm leading-6 text-secondary">
              기존에 사용한 계정을 선택하면 저장한 기록으로 이어집니다.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={loginWithGoogle}
                className="flex h-11 w-full items-center justify-between rounded-md border border-primary bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Google로 계속하기
                <i className="ri-arrow-right-line text-lg" />
              </button>
              <button
                type="button"
                onClick={loginWithKakao}
                className="flex h-11 w-full items-center justify-between rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                카카오로 계속하기
                <i className="ri-arrow-right-line text-lg" />
              </button>
            </div>

            <p className="mt-6 text-xs leading-5 text-secondary">
              로그인하면 ARCH-B의{' '}
              <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">이용약관</Link>
              과{' '}
              <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">개인정보 처리방침</Link>
              에 동의하게 됩니다.
            </p>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-5 text-xs text-secondary">
          <span>© 2026 ARCH-B</span>
          <Link href="/" className="transition hover:text-foreground">홈으로 돌아가기</Link>
        </div>
      </div>
    </main>
  );
}
