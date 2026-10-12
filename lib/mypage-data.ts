import "server-only";
import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeAvatarUrl } from "@/lib/avatar-url";

export type MypageProfile = {
  id: string;
  email: string;
  nickname: string;
  name: string;
  phone: string;
  tel: string;
  avatar_url: string | null;
  role: string;
};

export type MypageGalleryItem = {
  id: number;
  title: string;
  image_url: string | null;
  thumbnail_url: string | null;
  tags: string[] | null;
  description: string | null;
  created_at: string | null;
};

export type MypageReferenceItem = {
  id: number;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  logo_url: string | null;
  range: string[] | null;
  created_at: string | null;
};

export type MypagePostItem = {
  id: string;
  type: 'blog' | 'news';
  title: string;
  subtitle: string | null;
  summary: string | null;
  slug: string;
  title_image_url: string | null;
  published_at: string | null;
  created_at: string | null;
  scrap_count: number | null;
};

export type MypageActivity = {
  posts: MypagePostItem[];
  galleries: MypageGalleryItem[];
  references: MypageReferenceItem[];
};


const getMypageContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    admin: createAdminClient(),
    user,
  };
});
function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export const getMypageProfile = cache(async (): Promise<MypageProfile | null> => {
  const context = await getMypageContext();
  if (!context) return null;

  const { admin, user } = context;
  const { data: profile, error } = await admin
    .from("users")
    .select("id, email, nickname, name, phone, tel, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load mypage profile:", error.message);
  }

  const metadata = user.user_metadata || {};
  const email = firstString(profile?.email, user.email);

  return {
    id: user.id,
    email,
    nickname:
      firstString(profile?.nickname, metadata.full_name, metadata.name, email.split("@")[0]) ||
      "사용자",
    name: firstString(profile?.name, metadata.full_name, metadata.name),
    phone: firstString(profile?.phone),
    tel: firstString(profile?.tel),
    avatar_url: normalizeAvatarUrl(firstString(profile?.avatar_url, metadata.avatar_url, metadata.picture)),
    role: firstString(profile?.role) || "user",
  };
});
