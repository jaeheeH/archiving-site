import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuidParam } from "@/lib/route-params";

const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function safeExtension(file: File) {
  const fromType = file.type.split("/")[1];
  if (fromType === "jpeg") return "jpg";
  if (["jpg", "png", "webp"].includes(fromType)) return fromType;
  return "webp";
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const userId = formData.get("userId");
    const file = formData.get("file");

    if (typeof userId !== "string" || !isUuidParam(userId)) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Avatar file is required" }, { status: 400 });
    }

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      return NextResponse.json({ error: "JPG, PNG, WebP 이미지만 업로드할 수 있습니다." }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "아바타 이미지는 2MB 이하로 업로드해주세요." }, { status: 400 });
    }

    const admin = createAdminClient();
    const [{ data: currentUser }, { data: targetUser }] = await Promise.all([
      admin.from("users").select("id, role").eq("id", user.id).single(),
      admin.from("users").select("id, role").eq("id", userId).single(),
    ]);

    if (!currentUser || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isSelf = user.id === userId;
    const canManage =
      currentUser.role === "admin" ||
      (currentUser.role === "sub-admin" && targetUser.role !== "admin");

    if (!isSelf && !canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ext = safeExtension(file);
    const fileName = `${userId}/${userId}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await admin.storage.from("avatars").upload(fileName, buffer, {
      upsert: true,
      cacheControl: "31536000",
      contentType: file.type || "image/webp",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("avatars").getPublicUrl(fileName);

    return NextResponse.json({ success: true, url: `${publicUrl}?t=${Date.now()}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
