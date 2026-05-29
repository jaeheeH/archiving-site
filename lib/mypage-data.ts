import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type MypageProfile = {
  id: string;
  email: string;
  nickname: string;
  name: string;
  phone: string;
  tel: string;
  avatar_url: string | null;
};

export type MypageGalleryItem = {
  id: number;
  title: string;
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
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

export type MypageActivity = {
  galleries: MypageGalleryItem[];
  references: MypageReferenceItem[];
};

const ACTIVITY_LIMIT = 80;

async function getMypageContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    admin: createAdminClient(),
    user,
  };
}

async function readRows<T>(query: any): Promise<T[]> {
  const { data, error } = await query;

  if (error) {
    console.error("Mypage data query failed:", error.message);
    return [];
  }

  return data || [];
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function uniqueIds(values: Array<number | string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is number | string => value != null)));
}

export async function getMypageProfile(): Promise<MypageProfile | null> {
  const context = await getMypageContext();
  if (!context) return null;

  const { admin, user } = context;
  const { data: profile, error } = await admin
    .from("users")
    .select("id, email, nickname, name, phone, tel, avatar_url")
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
    avatar_url: firstString(profile?.avatar_url, metadata.avatar_url, metadata.picture) || null,
  };
}

export async function getMypageActivity(): Promise<MypageActivity | null> {
  const context = await getMypageContext();
  if (!context) return null;

  const { admin, user } = context;
  const [galleryScraps, referenceScraps] = await Promise.all([
    readRows<{ gallery_id: number }>(
      admin
        .from("gallery_scraps")
        .select("gallery_id")
        .eq("user_id", user.id)
        .limit(ACTIVITY_LIMIT)
    ),
    readRows<{ reference_id: number }>(
      admin
        .from("reference_scraps")
        .select("reference_id")
        .eq("user_id", user.id)
        .limit(ACTIVITY_LIMIT)
    ),
  ]);

  const galleryIds = uniqueIds(galleryScraps.map((item) => item.gallery_id));
  const referenceIds = uniqueIds(referenceScraps.map((item) => item.reference_id));

  const [galleries, references] = await Promise.all([
    galleryIds.length
      ? readRows<MypageGalleryItem>(
          admin
            .from("gallery")
            .select("id, title, image_url, image_width, image_height, tags, description, created_at")
            .in("id", galleryIds)
            .order("created_at", { ascending: false })
        )
      : Promise.resolve([]),
    referenceIds.length
      ? readRows<MypageReferenceItem>(
          admin
            .from("references")
            .select("id, title, description, url, image_url, logo_url, range, created_at")
            .in("id", referenceIds)
            .order("created_at", { ascending: false })
        )
      : Promise.resolve([]),
  ]);

  return {
    galleries,
    references,
  };
}
