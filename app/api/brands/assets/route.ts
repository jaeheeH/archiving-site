import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function safeExtension(file: File) {
  const fromType = file.type.split("/")[1];
  if (fromType === "jpeg") return "jpg";
  if (["jpg", "png", "webp"].includes(fromType)) return fromType;
  return "jpg";
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
    const brandId = formData.get("brandId");
    const file = formData.get("file");

    if (typeof brandId !== "string" || !brandId) {
      return NextResponse.json({ error: "브랜드 ID가 필요합니다." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지만 업로드할 수 있습니다." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "이미지는 5MB 이하로 업로드해주세요." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: brand } = await admin
      .from("brands")
      .select("id, user_id")
      .eq("id", brandId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!brand) {
      return NextResponse.json({ error: "브랜드를 찾을 수 없거나 권한이 없습니다." }, { status: 404 });
    }

    const ext = safeExtension(file);
    const random = Math.random().toString(36).slice(2, 10);
    const path = `${brandId}/${Date.now()}_${random}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await admin.storage.from("brand-assets").upload(path, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("brand-assets").getPublicUrl(path);

    return NextResponse.json({ success: true, url: publicUrl, path });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}
