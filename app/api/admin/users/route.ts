import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuidParam } from "@/lib/route-params";
import { normalizeAvatarUrl } from "@/lib/avatar-url";

const PROFILE_FIELDS = ["nickname", "name", "phone", "tel"] as const;
const ADMIN_FIELDS = ["role", "status"] as const;
const VALID_ROLES = ["user", "editor", "sub-admin", "admin"] as const;
const VALID_STATUSES = ["active", "inactive"] as const;

type UserRole = (typeof VALID_ROLES)[number];
type UserStatus = (typeof VALID_STATUSES)[number];

function isRole(value: unknown): value is UserRole {
  return typeof value === "string" && VALID_ROLES.includes(value as UserRole);
}

function isStatus(value: unknown): value is UserStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as UserStatus);
}

function sanitizeUpdates(updates: Record<string, unknown>, allowAdminFields: boolean) {
  const sanitized: Record<string, string | null> = {};

  for (const field of PROFILE_FIELDS) {
    if (field in updates) {
      const value = updates[field];
      sanitized[field] = typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null;
    }
  }

  if ("avatar_url" in updates) {
    sanitized.avatar_url = normalizeAvatarUrl(updates.avatar_url);
  }

  if (allowAdminFields && "role" in updates) {
    if (!isRole(updates.role)) {
      throw new Error("Invalid role");
    }
    sanitized.role = updates.role;
  }

  if (allowAdminFields && "status" in updates) {
    if (!isStatus(updates.status)) {
      throw new Error("Invalid status");
    }
    sanitized.status = updates.status;
  }

  return sanitized;
}

export async function PATCH(request: Request) {
  try {
    let body: { userId?: unknown; updates?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request" }, { status: 400 });
    }

    const { userId, updates } = body;

    if (
      typeof userId !== "string" ||
      !isUuidParam(userId) ||
      !updates ||
      typeof updates !== "object" ||
      Array.isArray(updates)
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const updatePayload = updates as Record<string, unknown>;

    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: currentUser, error: currentError } = await admin
      .from("users")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (currentError || !currentUser) {
      return NextResponse.json({ error: "Current user not found" }, { status: 404 });
    }

    const { data: targetUser, error: targetError } = await admin
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .single();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const isSelf = user.id === userId;
    const currentRole = currentUser.role as UserRole;
    const targetRole = targetUser.role as UserRole;

    if (!isSelf && currentRole !== "admin" && currentRole !== "sub-admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (currentRole === "sub-admin" && targetRole === "admin") {
      return NextResponse.json({ error: "Cannot update admin user" }, { status: 403 });
    }

    const hasAdminField = ADMIN_FIELDS.some((field) => field in updatePayload);

    if (isSelf && hasAdminField) {
      return NextResponse.json({ error: "Cannot change your own role or status" }, { status: 403 });
    }

    if (hasAdminField && currentRole !== "admin" && currentRole !== "sub-admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (updatePayload.role === "admin" && currentRole !== "admin") {
      return NextResponse.json({ error: "Only admins can assign admin role" }, { status: 403 });
    }

    const sanitized = sanitizeUpdates(updatePayload, !isSelf);

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: "No valid updates" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("users")
      .update(sanitized)
      .eq("id", userId)
      .select("id, role, status, nickname, name, phone, tel, avatar_url")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
