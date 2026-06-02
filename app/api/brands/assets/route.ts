import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { getBrandManagerContext } from "@/lib/brand-manager-auth";
import { isSafeIdentifierParam } from "@/lib/route-params";

const ALLOWED_BRAND_ASSET_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function safeExtension(file: File) {
  const fromType = file.type.split("/")[1];
  if (fromType === "jpeg") return "jpg";
  if (["jpg", "png", "webp"].includes(fromType)) return fromType;
  return "jpg";
}

export async function POST(request: NextRequest) {
  try {
    const context = await getBrandManagerContext();
    if (context.response) return context.response;

    const formData = await request.formData();
    const brandId = formData.get("brandId");
    const file = formData.get("file");

    if (typeof brandId !== "string" || !isSafeIdentifierParam(brandId)) {
      return NextResponse.json({ error: "브랜드 ID가 필요합니다." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
    }

    if (!ALLOWED_BRAND_ASSET_TYPES.has(file.type)) {
      return NextResponse.json({ error: "JPG, PNG, WebP 이미지만 업로드할 수 있습니다." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "이미지는 5MB 이하로 업로드해주세요." }, { status: 400 });
    }

    const { data: brand } = await context.admin
      .from("brands")
      .select("id, user_id")
      .eq("id", brandId)
      .eq("user_id", context.user.id)
      .maybeSingle();

    if (!brand) {
      return NextResponse.json({ error: "브랜드를 찾을 수 없거나 권한이 없습니다." }, { status: 404 });
    }

    const ext = safeExtension(file);
    const random = randomUUID().replace(/-/g, "").slice(0, 12);
    const path = `${brandId}/${Date.now()}_${random}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await context.admin.storage.from("brand-assets").upload(path, buffer, {
      cacheControl: "31536000",
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const {
      data: { publicUrl },
    } = context.admin.storage.from("brand-assets").getPublicUrl(path);

    return NextResponse.json({ success: true, url: publicUrl, path });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}
