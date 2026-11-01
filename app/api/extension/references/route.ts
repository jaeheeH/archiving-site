import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { randomUUID } from "node:crypto";
import sharp from 'sharp';
import { uploadImageWithVariants } from '@/lib/upload-image';

import { getErrorMessage } from "@/lib/error-message";
import {
  isReferenceExtensionRole,
  verifyExtensionToken,
} from "@/lib/extension-token";
import {
  CACHE_TAGS,
} from "@/lib/public-data";
import { readCapturedReferenceImage, readRemoteReferenceImage } from "@/lib/reference-assets";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPrimaryReferenceCategory,
  normalizeReferenceRange,
  normalizeReferenceText,
  normalizeReferenceTitle,
  normalizeReferenceUrl,
} from "@/lib/supabase/reference-utils";

const REFERENCE_WRITE_COLUMNS =
  "id, title, description, url, image_url, logo_url, category, range, clicks, created_at, updated_at";
const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REFERENCE_LOGO_BYTES = 4 * 1024 * 1024;

type ExtensionUser = {
  id: string;
  role: string;
};

function extensionCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...extensionCorsHeaders(),
      ...(init?.headers || {}),
    },
  });
}

async function parseJsonObject(req: NextRequest) {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const [scheme, token] = auth.split(/\s+/);

  return scheme?.toLowerCase() === "bearer" ? token : null;
}

function getFaviconFallback(url: string) {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
  } catch {
    return null;
  }
}

function isReferenceStorageUrl(value: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;

  try {
    const storageOrigin = new URL(supabaseUrl).origin;
    const url = new URL(value);

    return (
      url.origin === storageOrigin &&
      url.pathname.startsWith("/storage/v1/object/public/references/")
    );
  } catch {
    return false;
  }
}

async function storeReferenceAsset(admin: ReturnType<typeof createAdminClient>, buffer: Buffer, userId: string, kind: "thumbnail" | "logo") {
  const folder = kind === "logo" ? "logos" : "thumbnails";
  const { format } = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata();
  const extension = format === 'jpeg' ? 'jpg' : format;
  if (!['jpg', 'png', 'webp', 'gif'].includes(extension || '')) throw new Error('지원하지 않는 이미지 파일입니다.');
  const filePath = "references/extension/" + userId + "/" + folder + "/" + randomUUID() + '.' + extension;
  const uploaded = await uploadImageWithVariants(admin, 'references', filePath, buffer, `image/${format}`);
  return kind === 'logo' ? uploaded.variants.find(item => item.width === 320)?.url || uploaded.url : uploaded.url;
}

async function uploadRemoteReferenceAsset({ admin, sourceUrl, userId, kind }: {
  admin: ReturnType<typeof createAdminClient>; sourceUrl: string | null; userId: string; kind: "thumbnail" | "logo";
}) {
  if (!sourceUrl) return null;
  if (isReferenceStorageUrl(sourceUrl)) return sourceUrl;
  try {
    const buffer = await readRemoteReferenceImage(sourceUrl, kind === "logo" ? MAX_REFERENCE_LOGO_BYTES : MAX_REFERENCE_IMAGE_BYTES);
    return await storeReferenceAsset(admin, buffer, userId, kind);
  } catch { return null; }
}

async function getExtensionUser(req: NextRequest): Promise<{
  user: ExtensionUser | null;
  error: NextResponse | null;
}> {
  const payload = verifyExtensionToken(getBearerToken(req));

  if (!payload) {
    return {
      user: null,
      error: json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("role")
    .eq("id", payload.sub)
    .single();
  const userRole = data as { role?: string | null } | null;

  if (error || !userRole?.role) {
    return {
      user: null,
      error: json({ error: "User not found" }, { status: 404 }),
    };
  }

  if (!isReferenceExtensionRole(userRole.role)) {
    return {
      user: null,
      error: json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    user: {
      id: payload.sub,
      role: userRole.role,
    },
    error: null,
  };
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: extensionCorsHeaders(),
  });
}

export async function GET(req: NextRequest) {
  try {
    const payload = verifyExtensionToken(getBearerToken(req));
    const admin = createAdminClient();
    const { data: categories, error } = await admin
      .from("reference_categories")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return json(
      {
        success: true,
        authenticated: Boolean(payload),
        categories: categories || [],
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Extension reference metadata error:", error);

    return json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getExtensionUser(req);
    if (authError) return authError;

    const body = await parseJsonObject(req);
    if (!body) {
      return json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
    }

    const normalizedUrl = normalizeReferenceUrl(body.url);
    const normalizedTitle = normalizeReferenceTitle(body.title);
    const normalizedDescription = normalizeReferenceText(body.description);
    const normalizedRange = normalizeReferenceRange(body.range);
    if (!Array.isArray(body.range) || body.range.length < 1 || body.range.length > 3 || normalizedRange.length !== body.range.length) {
      return json({ error: "범주는 1–3개 선택해주세요." }, { status: 400 });
    }

    if (!normalizedTitle || !normalizedUrl) {
      return json({ error: "title and url are required" }, { status: 400 });
    }

    const siteUrl = new URL(normalizedUrl);
    if (siteUrl.username || siteUrl.password) return json({ error: "계정 정보가 포함된 주소는 등록할 수 없습니다." }, { status: 400 });
    siteUrl.hash = "";
    const referenceUrl = siteUrl.href;
    const admin = createAdminClient();
    const { data: categories, error: categoryError } = await admin.from("reference_categories").select("name").in("name", normalizedRange);
    if (categoryError) throw categoryError;
    if (categories?.length !== normalizedRange.length) return json({ error: "관리자에 등록된 범주를 선택해주세요." }, { status: 400 });
    const { data: existing, error: existingError } = await admin
      .from("references")
      .select(REFERENCE_WRITE_COLUMNS)
      .in("url", [referenceUrl, referenceUrl.replace(/\/$/, "")])
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return json({
        success: true,
        duplicate: true,
        data: existing,
      });
    }

    let capturedImage: Buffer | null = null;
    try {
      if (body.image_data_url !== undefined) {
        capturedImage = readCapturedReferenceImage(body.image_data_url);
        const metadata = await sharp(capturedImage, { limitInputPixels: 40_000_000 }).metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format || '')) throw new Error('올바른 캡처 이미지가 필요합니다.');
      }
    } catch (error) { return json({ error: getErrorMessage(error) }, { status: 400 }); }
    const fallbackLogo = getFaviconFallback(referenceUrl);
    const remoteLogoUrl = normalizeReferenceUrl(body.logo_url) || fallbackLogo;
    const remoteImageUrl = normalizeReferenceUrl(body.image_url);
    const [uploadedLogoUrl, uploadedImageUrl] = await Promise.all([
      (async () => {
        const logo = await uploadRemoteReferenceAsset({ admin, sourceUrl: remoteLogoUrl, userId: user!.id, kind: "logo" });
        return logo || (remoteLogoUrl !== fallbackLogo ? await uploadRemoteReferenceAsset({ admin, sourceUrl: fallbackLogo, userId: user!.id, kind: "logo" }) : null);
      })(),
      capturedImage ? storeReferenceAsset(admin, capturedImage, user!.id, "thumbnail")
        : uploadRemoteReferenceAsset({ admin, sourceUrl: remoteImageUrl, userId: user!.id, kind: "thumbnail" }),
    ]);
    const normalizedLogoUrl = uploadedLogoUrl || uploadedImageUrl;
    const normalizedImageUrl = uploadedImageUrl;
    if (!normalizedImageUrl || !normalizedLogoUrl) {
      return json(
        { error: "이미지를 저장하지 못했습니다. 확장 프로그램에서 현재 화면을 캡처하거나 이미지 주소를 바꿔주세요." },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("references")
      .insert({
        title: normalizedTitle,
        description: normalizedDescription,
        url: referenceUrl,
        image_url: normalizedImageUrl,
        logo_url: normalizedLogoUrl,
        category: getPrimaryReferenceCategory(normalizedRange, body.category),
        range: normalizedRange,
        clicks: 0,
        author: user!.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(REFERENCE_WRITE_COLUMNS)
      .single();

    if (error) throw error;

    revalidateTag(CACHE_TAGS.references, "max");
    revalidateTag(CACHE_TAGS.home, "max");

    return json({
      success: true,
      duplicate: false,
      data,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Extension reference create error:", error);

    return json({ error: message }, { status: 500 });
  }
}
