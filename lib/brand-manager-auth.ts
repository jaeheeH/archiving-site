import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type BrandManagerRole = "admin" | "sub-admin";

type BrandManagerContext =
  | {
      admin: ReturnType<typeof createAdminClient>;
      user: User;
      role: BrandManagerRole;
      response?: never;
    }
  | {
      response: NextResponse;
      admin?: never;
      user?: never;
      role?: never;
    };

function isBrandManagerRole(role: unknown): role is BrandManagerRole {
  return role === "admin" || role === "sub-admin";
}

export async function getBrandManagerContext(): Promise<BrandManagerContext> {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!isBrandManagerRole(profile?.role)) {
    return {
      response: NextResponse.json({ error: "브랜드 관리 권한이 없습니다." }, { status: 403 }),
    };
  }

  return { admin, user, role: profile.role };
}
