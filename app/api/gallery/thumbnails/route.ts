import { randomUUID } from "crypto";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { getErrorMessage } from "@/lib/error-message";
import { CACHE_TAGS } from "@/lib/public-data";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkGalleryEditPermission,
  extractGalleryStoragePath,
  isSafeGalleryStoragePath,
} from "@/lib/supabase/gallery-utils";

type GalleryThumbnailTarget = {
  id: number;
  image_url: string | null;
  thumbnail_url: string | null;
};

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_QUALITY = 76;
const MAX_THUMBNAIL_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_THUMBNAIL_BATCH = 12;
const DEBUG_API_LOGS = process.env.DEBUG_API_LOGS === "true";

function debugLog(...args: unknown[]) {
  if (DEBUG_API_LOGS) console.info(...args);
}

async function requireThumbnailMigrationAccess(req: NextRequest) {
  const migrationToken = req.headers.get("x-migration-token")?.trim();
  const validToken = process.env.MIGRATION_TOKEN?.trim();

  if (migrationToken && validToken && migrationToken === validToken) {
    return null;
  }

  const permCheck = await checkGalleryEditPermission();
  return permCheck.authorized ? null : permCheck.error!;
}

function normalizeBatchLimit(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return 5;
  return Math.min(Math.floor(numeric), MAX_THUMBNAIL_BATCH);
}

async function parseJsonObject(req: NextRequest) {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function getThumbnailOwnerSegment(storagePath: string) {
  const firstSegment = storagePath.split("/")[0]?.trim();

  if (firstSegment && isSafeGalleryStoragePath(firstSegment)) {
    return firstSegment;
  }

  return "legacy";
}

async function createGalleryThumbnail(
  admin: ReturnType<typeof createAdminClient>,
  item: GalleryThumbnailTarget
) {
  if (!item.image_url) {
    throw new Error("image_url is empty");
  }

  const originalPath = extractGalleryStoragePath(item.image_url);

  if (!originalPath) {
    await admin
      .from("gallery")
      .update({ thumbnail_url: item.image_url })
      .eq("id", item.id);

    return {
      id: item.id,
      status: "skipped_external",
      thumbnail_url: item.image_url,
    };
  }

  if (!isSafeGalleryStoragePath(originalPath)) {
    throw new Error("Unsafe gallery storage path");
  }

  const { data: sourceBlob, error: downloadError } = await admin.storage
    .from("gallery")
    .download(originalPath);

  if (downloadError) {
    throw downloadError;
  }

  const sourceBuffer = Buffer.from(await sourceBlob.arrayBuffer());

  if (sourceBuffer.byteLength > MAX_THUMBNAIL_SOURCE_BYTES) {
    throw new Error("Source image is too large");
  }

  const thumbnailBuffer = await sharp(sourceBuffer, { animated: false })
    .rotate()
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: THUMBNAIL_QUALITY, mozjpeg: true })
    .toBuffer();

  const ownerSegment = getThumbnailOwnerSegment(originalPath);
  const random = randomUUID().replace(/-/g, "").slice(0, 12);
  const thumbnailPath = `${ownerSegment}/thumbnails/backfill_${item.id}_${random}.jpg`;

  const { error: uploadError } = await admin.storage
    .from("gallery")
    .upload(thumbnailPath, thumbnailBuffer, {
      cacheControl: "31536000",
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("gallery").getPublicUrl(thumbnailPath);

  const { error: updateError } = await admin
    .from("gallery")
    .update({ thumbnail_url: publicUrl })
    .eq("id", item.id);

  if (updateError) {
    await admin.storage.from("gallery").remove([thumbnailPath]);
    throw updateError;
  }

  return {
    id: item.id,
    status: "success",
    thumbnail_url: publicUrl,
  };
}

export async function POST(req: NextRequest) {
  try {
    const authError = await requireThumbnailMigrationAccess(req);
    if (authError) return authError;

    const body = await parseJsonObject(req);
    const limit = normalizeBatchLimit(body.limit);
    const admin = createAdminClient();

    const { data: galleryItems, error: queryError } = await admin
      .from("gallery")
      .select("id, image_url, thumbnail_url")
      .is("thumbnail_url", null)
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (queryError) {
      throw queryError;
    }

    if (!galleryItems?.length) {
      return NextResponse.json({
        success: true,
        message: "생성할 썸네일이 없습니다.",
        processed: 0,
        failed: 0,
        totalRemaining: 0,
      });
    }

    const processedItems = [];
    const failedItems = [];

    for (const item of galleryItems as GalleryThumbnailTarget[]) {
      try {
        debugLog("Creating gallery thumbnail", item.id);
        const result = await createGalleryThumbnail(admin, item);
        processedItems.push(result);
      } catch (error) {
        const message = getErrorMessage(error);
        console.error(`Gallery thumbnail backfill failed: ${item.id}`, error);
        failedItems.push({
          id: item.id,
          status: "failed",
          error: message,
        });
      }
    }

    const { count: remainingCount, error: remainingError } = await admin
      .from("gallery")
      .select("id", { count: "exact", head: true })
      .is("thumbnail_url", null)
      .not("image_url", "is", null);

    if (remainingError) {
      throw remainingError;
    }

    if (processedItems.length > 0) {
      revalidateTag(CACHE_TAGS.gallery, "max");
      revalidateTag(CACHE_TAGS.home, "max");
    }

    return NextResponse.json({
      success: true,
      processed: processedItems.length,
      failed: failedItems.length,
      totalRemaining: remainingCount || 0,
      processedItems,
      failedItems,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Gallery thumbnail backfill error:", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authError = await requireThumbnailMigrationAccess(req);
    if (authError) return authError;

    const admin = createAdminClient();

    const [totalResult, pendingResult] = await Promise.all([
      admin.from("gallery").select("id", { count: "exact", head: true }),
      admin
        .from("gallery")
        .select("id", { count: "exact", head: true })
        .is("thumbnail_url", null)
        .not("image_url", "is", null),
    ]);

    if (totalResult.error) throw totalResult.error;
    if (pendingResult.error) throw pendingResult.error;

    const total = totalResult.count || 0;
    const remaining = pendingResult.count || 0;
    const processed = total - remaining;

    return NextResponse.json({
      success: true,
      status: {
        total,
        processed,
        remaining,
        percentage: total ? Math.round((processed / total) * 100) : 0,
      },
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Gallery thumbnail status error:", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
