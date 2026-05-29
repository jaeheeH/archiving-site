import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

    if (typeof userId !== "string" || !userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Avatar file is required" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지만 업로드할 수 있습니다." }, { status: 400 });
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

    const fileName = `${userId}/${userId}.webp`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await admin.storage.from("avatars").upload(fileName, buffer, {
      upsert: true,
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
