import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { checkReferenceEditPermission } from "@/lib/supabase/reference-utils";

const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REFERENCE_LOGO_BYTES = 4 * 1024 * 1024;
const ALLOWED_REFERENCE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function normalizeKind(value: FormDataEntryValue | null) {
  return value === "logo" ? "logo" : "thumbnail";
}

function safeExtension(file: File) {
  const fromType = file.type.split("/")[1];
  if (fromType === "jpeg") return "jpg";
  if (["jpg", "png", "webp", "gif"].includes(fromType)) return fromType;
  return "bin";
}

export async function POST(request: NextRequest) {
  try {
    const permCheck = await checkReferenceEditPermission();
    if (!permCheck.authorized) return permCheck.error!;

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = normalizeKind(formData.get("kind"));
    const maxBytes = kind === "logo" ? MAX_REFERENCE_LOGO_BYTES : MAX_REFERENCE_IMAGE_BYTES;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
    }

    if (!ALLOWED_REFERENCE_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "JPG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다." }, { status: 400 });
    }

    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `이미지는 최대 ${Math.floor(maxBytes / 1024 / 1024)}MB까지 업로드할 수 있습니다.` },
        { status: 400 }
      );
    }

    const folder = kind === "logo" ? "logos" : "thumbnails";
    const fileName = `${Date.now()}-${randomUUID()}.${safeExtension(file)}`;
    const filePath = `references/${folder}/${fileName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const admin = createAdminClient();

    const { error } = await admin.storage.from("references").upload(filePath, buffer, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("references").getPublicUrl(filePath);

    return NextResponse.json(
      { success: true, url: publicUrl, path: filePath },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}
