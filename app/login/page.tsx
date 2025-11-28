"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const loginWithGoogle = async () => {
    const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
      : `${location.origin}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
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

  return (
    <div className="p-4 flex flex-col gap-3">
      <button
        onClick={loginWithGoogle}
        className="bg-black text-white px-4 py-2 rounded"
      >
        Google 로그인
      </button>
      <button
        onClick={loginWithKakao}
        className="bg-[#FEE500] text-[#000000] px-4 py-2 rounded font-medium"
      >
        카카오 로그인
      </button>
    </div>
  );
}