"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProfileTab from "../components/ProfileTab";

type UserProfile = {
  id: string;
  email?: string;
  nickname: string;
  avatar_url: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
          router.replace("/login");
          return;
        }

        const { data: dbUser, error: dbError } = await supabase
          .from("users")
          .select("nickname, avatar_url")
          .eq("id", authUser.id)
          .single();

        if (dbError) {
          console.error("Failed to fetch user data:", dbError);
        }

        setUser({
          id: authUser.id,
          email: authUser.email,
          nickname: dbUser?.nickname || authUser.email?.split("@")[0] || "사용자",
          avatar_url: dbUser?.avatar_url || null,
        });
      } catch (error) {
        console.error("Unexpected error:", error);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <ProfileTab user={user} />;
}
