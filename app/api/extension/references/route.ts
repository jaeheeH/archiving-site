import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

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

    const fallbackLogo = getFaviconFallback(normalizedUrl);
    const normalizedLogoUrl = normalizeReferenceUrl(body.logo_url) || fallbackLogo;
    const normalizedImageUrl =
      normalizeReferenceUrl(body.image_url) || normalizedLogoUrl || fallbackLogo;

    if (!normalizedImageUrl || !normalizedLogoUrl) {
      return json({ error: "image_url or logo_url is required" }, { status: 400 });
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
