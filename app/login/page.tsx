"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          router.push("/"); // 이미 로그인되어 있으면 홈으로
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setIsChecking(false);
      }
    };
    checkAuth();
  }, [router, supabase]);

  const loginWithGoogle = async () => {
    const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
      : `${location.origin}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });
  };

  const loginWithKakao = async () => {
    const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
      : `${location.origin}/auth/callback`;

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