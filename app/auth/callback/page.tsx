"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const handleCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

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
        const updateData: any = {
          last_login_at: new Date().toISOString(),
        };

        // avatar_url이 없을 때만 Google 이미지 사용
        if (!existingUser?.avatar_url) {
          updateData.avatar_url = metadata.avatar_url || metadata.picture || null;
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

        router.push("/");
      } else if (error) {
        console.error("Auth error:", error);
        router.push("/login?error=auth");
      }
    };

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        handleCallback();
      }
    });

    handleCallback();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>로그인 처리중...</p>
    </div>
  );
}