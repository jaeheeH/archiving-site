"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
  };

  const loginWithKakao = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
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