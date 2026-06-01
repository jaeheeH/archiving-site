"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeAvatarUrl } from "@/lib/avatar-url";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let isActive = true;
    let hasHandled = false;

    function getSafeNextPath() {
      const next = new URLSearchParams(window.location.search).get("next");
      if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
      if (next === "/login" || next.startsWith("/auth/callback")) return "/";
      return next.includes("\n") || next.includes("\r") ? "/" : next;
    }

    type AuthSession = Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"];

    const handleCallback = async (providedSession?: AuthSession) => {
      if (hasHandled) return;
      hasHandled = true;

      const { data: { session }, error } = providedSession
        ? { data: { session: providedSession }, error: null }
        : await supabase.auth.getSession();

      if (session?.user) {
        const user = session.user;
        const metadata = user.user_metadata;

        // 현재 users 테이블의 정보 확인
        const { data: existingUser } = await supabase
          .from("users")
          .select("avatar_url, nickname")
          .eq("id", user.id)
          .single();

        // 업데이트할 데이터 준비
        const updateData: Record<string, string | null> = {
          last_login_at: new Date().toISOString(),
        };

        // avatar_url이 없을 때만 Google 이미지 사용
        if (!existingUser?.avatar_url) {
          updateData.avatar_url = normalizeAvatarUrl(metadata.avatar_url || metadata.picture);
        }

        // nickname이 없을 때만 Google 이름 사용
        if (!existingUser?.nickname) {
          updateData.nickname = metadata.full_name || metadata.name || null;
        }

        // users 테이블 업데이트
        await supabase
          .from("users")
          .update(updateData)
          .eq("id", user.id);

        if (isActive) {
          router.replace(getSafeNextPath());
        }
      } else {
        hasHandled = false;
        if (!isActive) return;
        if (error) {
          console.error("Auth error:", error);
        }
        router.replace("/login?error=auth");
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        handleCallback(session);
      }
    });

    handleCallback();

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>로그인 처리중...</p>
    </div>
  );
}
