import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getErrorMessage } from "@/lib/error-message";
import { uploadImageWithVariants } from '@/lib/upload-image';
import { imageAssetPaths } from '@/lib/image-variants';

const MAX_SITE_ASSET_SIZE = 4 * 1024 * 1024;
const ALLOWED_SITE_ASSET_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

function sanitizePathSegment(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== "string") return fallback;
  const segment = value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  return segment || fallback;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\\/g, "/").split("/").pop()?.replace(/[^a-zA-Z0-9._-]/g, "_") || "asset";
}

function isSafeStoragePath(value: string) {
  return (
    value.length <= 512 &&
    !value.startsWith("/") &&
    !value.includes("..") &&
    /^[a-zA-Z0-9._/-]+$/.test(value)
  );
}

async function requireSiteAssetAdmin() {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return {
      adminClient: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const adminClient = createAdminClient();
  const { data: userData } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userData || !["admin", "sub-admin"].includes(userData.role)) {
    return {
      adminClient: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { adminClient, error: null };
}

/**
 * POST /api/upload/site-asset
 * 사이트 에셋 이미지 업로드 (favicon, og-image 등)
 * 권한: 인증된 사용자
 */
export async function POST(req: NextRequest) {
  try {
    const { adminClient, error: authError } = await requireSiteAssetAdmin();
    if (authError) return authError;

    // 2. FormData 파싱
    const formData = await req.formData();
    const file = formData.get("file");
    const folder = sanitizePathSegment(formData.get("folder"), "misc"); // 'favicon', 'og-image', 'icons' 등

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_SITE_ASSET_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported image type" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SITE_ASSET_SIZE) {
      return NextResponse.json(
        { error: "Image must be 4MB or smaller" },
        { status: 400 }
      );
    }

    // 3. 파일명 생성 (타임스탬프 + 원본 파일명)
    const timestamp = Date.now();
    const fileName = `${folder}/${timestamp}-${sanitizeFileName(file.name)}`;

    // Favicons need their original format; content images get prepared WebP files.
    const buffer = Buffer.from(await file.arrayBuffer());
    const preserveFormat = /favicon|icon|og-image/.test(folder);
    const uploaded = await uploadImageWithVariants(adminClient!, 'site-assets', fileName, buffer, file.type, { preserveFormat });

    return NextResponse.json({
      success: true,
      data: {
        ...uploaded,
        ...(preserveFormat ? { path: uploaded.original_path, url: uploaded.original_url } : {}),
      },
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error, "Upload failed");
    console.error("❌ 이미지 업로드 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload/site-asset
 * 사이트 에셋 이미지 삭제
 * 권한: admin, sub-admin
 */
export async function DELETE(req: NextRequest) {
  try {
    const { adminClient, error: authError } = await requireSiteAssetAdmin();
    if (authError) return authError;

    // 2. 파일 경로 가져오기
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      );
    }

    if (!isSafeStoragePath(filePath)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    // 3. 파일 삭제
    const { error } = await adminClient!.storage
      .from("site-assets")
      .remove(imageAssetPaths(filePath));

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error, "Delete failed");
    console.error("❌ 이미지 삭제 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
