import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { randomUUID } from "node:crypto";

import { getErrorMessage } from "@/lib/error-message";
import {
  isReferenceExtensionRole,
  verifyExtensionToken,
} from "@/lib/extension-token";
import {
  CACHE_TAGS,
  PUBLIC_API_CACHE_CONTROL,
} from "@/lib/public-data";
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
const REMOTE_ASSET_TIMEOUT_MS = 12_000;
const ALLOWED_REFERENCE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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

function isBlockedAssetHost(hostname: string) {
  const normalized = hostname.toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.startsWith("127.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

function normalizeRemoteAssetUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (isBlockedAssetHost(url.hostname)) return null;

    return url.toString();
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

function extensionFromContentType(contentType: string) {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase();

  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";

  return null;
}

async function uploadRemoteReferenceAsset({
  admin,
  sourceUrl,
  userId,
  kind,
}: {
  admin: ReturnType<typeof createAdminClient>;
  sourceUrl: string | null;
  userId: string;
  kind: "thumbnail" | "logo";
}) {
  const safeSourceUrl = normalizeRemoteAssetUrl(sourceUrl);
  if (!safeSourceUrl) return null;
  if (isReferenceStorageUrl(safeSourceUrl)) return safeSourceUrl;

  try {
    const response = await fetch(safeSourceUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.5",
        "User-Agent": "ARCH-B Reference Clipper/0.1",
      },
      signal: AbortSignal.timeout(REMOTE_ASSET_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
    if (!ALLOWED_REFERENCE_IMAGE_TYPES.has(contentType)) return null;

    const maxBytes = kind === "logo" ? MAX_REFERENCE_LOGO_BYTES : MAX_REFERENCE_IMAGE_BYTES;
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > maxBytes) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) return null;

    const extension = extensionFromContentType(contentType);
    if (!extension) return null;

    const folder = kind === "logo" ? "logos" : "thumbnails";
    const random = randomUUID().replace(/-/g, "").slice(0, 12);
    const filePath = `references/extension/${userId}/${folder}/${Date.now()}-${random}.${extension}`;
    const { error } = await admin.storage.from("references").upload(filePath, buffer, {
      cacheControl: "31536000",
      contentType,
      upsert: false,
    });

    if (error) throw error;

    const {
      data: { publicUrl },
    } = admin.storage.from("references").getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.warn("Extension reference asset upload failed:", sourceUrl, error);
    return null;
  }
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
          "Cache-Control": PUBLIC_API_CACHE_CONTROL,
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
    const fallbackRange = normalizedRange.length > 0 ? normalizedRange : ["미분류"];

    if (!normalizedTitle || !normalizedUrl) {
      return json({ error: "title and url are required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("references")
      .select(REFERENCE_WRITE_COLUMNS)
      .eq("url", normalizedUrl)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return json({
        success: true,
        duplicate: true,
        data: existing,
      });
    }

    const fallbackLogo = getFaviconFallback(normalizedUrl);
    const remoteLogoUrl = normalizeReferenceUrl(body.logo_url) || fallbackLogo;
    const remoteImageUrl = normalizeReferenceUrl(body.image_url) || remoteLogoUrl || fallbackLogo;
    const uploadedLogoUrl = await uploadRemoteReferenceAsset({
      admin,
      sourceUrl: remoteLogoUrl,
      userId: user!.id,
      kind: "logo",
    });
    const uploadedImageUrl = await uploadRemoteReferenceAsset({
      admin,
      sourceUrl: remoteImageUrl,
      userId: user!.id,
      kind: "thumbnail",
    });
    const normalizedLogoUrl = uploadedLogoUrl || uploadedImageUrl;
    const normalizedImageUrl = uploadedImageUrl || uploadedLogoUrl;

    if (!normalizedImageUrl || !normalizedLogoUrl) {
      return json(
        { error: "레퍼런스 이미지를 Supabase Storage에 저장하지 못했습니다." },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("references")
      .insert({
        title: normalizedTitle,
        description: normalizedDescription,
        url: normalizedUrl,
        image_url: normalizedImageUrl,
        logo_url: normalizedLogoUrl,
        category: getPrimaryReferenceCategory(fallbackRange, body.category),
        range: fallbackRange,
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
