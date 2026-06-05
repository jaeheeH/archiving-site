import { NextResponse } from "next/server";

import { getErrorMessage } from "@/lib/error-message";
import {
  issueExtensionToken,
  isReferenceExtensionRole,
} from "@/lib/extension-token";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type UserRoleRow = {
  email?: string | null;
  nickname?: string | null;
  name?: string | null;
  role?: string | null;
};

async function getCurrentExtensionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
      profile: null,
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("email, nickname, name, role")
    .eq("id", user.id)
    .single();
  const profile = data as UserRoleRow | null;

  if (error || !profile?.role) {
    return {
      error: NextResponse.json({ error: "User not found" }, { status: 404 }),
      user: null,
      profile: null,
    };
  }

  if (!isReferenceExtensionRole(profile.role)) {
    return {
      error: NextResponse.json(
        { error: "Only reference managers can connect the extension" },
        { status: 403 }
      ),
      user: null,
      profile: null,
    };
  }

  return {
    error: null,
    user,
    profile,
  };
}

export async function POST() {
  try {
    const { error, user, profile } = await getCurrentExtensionUser();
    if (error) return error;

    const { token, expiresAt } = issueExtensionToken({
      userId: user!.id,
      role: profile!.role!,
    });

    return NextResponse.json({
      success: true,
      token,
      expiresAt,
      siteUrl: getSiteUrl(),
      user: {
        id: user!.id,
        email: profile!.email || user!.email || "",
        nickname: profile!.nickname || profile!.name || user!.email || "ARCH-B",
        role: profile!.role,
      },
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Extension token issue error:", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { error, user, profile } = await getCurrentExtensionUser();
    if (error) return error;

    return NextResponse.json({
      success: true,
      siteUrl: getSiteUrl(),
      user: {
        id: user!.id,
        email: profile!.email || user!.email || "",
        nickname: profile!.nickname || profile!.name || user!.email || "ARCH-B",
        role: profile!.role,
      },
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Extension token status error:", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
