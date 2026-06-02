import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";

import { createAdminClient } from "@/lib/supabase/admin";
import { checkGalleryEditPermission } from "@/lib/supabase/gallery-utils";

const ALLOWED_GALLERY_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const THUMBNAIL_WIDTH = 640;

function safeExtension(file: File) {
  const fromType = file.type.split("/")[1];
  if (fromType === "jpeg") return "jpg";
  if (["jpg", "png", "webp", "gif"].includes(fromType)) return fromType;

  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  return "jpg";
}

export async function POST(request: NextRequest) {
  try {
    const permCheck = await checkGalleryEditPermission();
    if (!permCheck.authorized) return permCheck.error!;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
    }

    if (!ALLOWED_GALLERY_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "JPG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다." }, { status: 400 });
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "이미지는 8MB 이하로 업로드해주세요." }, { status: 400 });
    }

    const admin = createAdminClient();
    const random = randomUUID().replace(/-/g, "").slice(0, 12);
    const createdAt = Date.now();
    const ext = safeExtension(file);
    const originalPath = `${permCheck.userId}/originals/${createdAt}_${random}.${ext}`;
    const thumbnailPath = `${permCheck.userId}/thumbnails/${createdAt}_${random}.jpg`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const thumbnailBuffer = await sharp(buffer, { animated: false })
      .rotate()
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 76, mozjpeg: true })
      .toBuffer();

    const { error } = await admin.storage.from("gallery").upload(originalPath, buffer, {
      cacheControl: "31536000",
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { error: thumbnailError } = await admin.storage.from("gallery").upload(
      thumbnailPath,
      thumbnailBuffer,
      {
        cacheControl: "31536000",
        contentType: "image/jpeg",
        upsert: false,
      }
    );

    if (thumbnailError) {
      await admin.storage.from("gallery").remove([originalPath]);
      return NextResponse.json({ error: thumbnailError.message }, { status: 400 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("gallery").getPublicUrl(originalPath);

    const {
      data: { publicUrl: thumbnailUrl },
    } = admin.storage.from("gallery").getPublicUrl(thumbnailPath);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      thumbnail_url: thumbnailUrl,
      path: originalPath,
      thumbnail_path: thumbnailPath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}
