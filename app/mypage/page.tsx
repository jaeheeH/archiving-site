"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/mypage/profile");
  }, [router]);

  return (
    <div className="h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500">로딩 중...</p>
      </div>
    </div>
  );
}
