import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { CACHE_TAGS } from "@/lib/public-data";
import { isSafeIdentifierParam } from "@/lib/route-params";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BANNER_COLUMNS =
  "id, title, subtitle, label, image_url, link, is_continuous, start_date, end_date, order_index, is_active";
const MAX_BANNER_TEXT_LENGTH = 160;

function normalizeString(value: unknown, max = MAX_BANNER_TEXT_LENGTH) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function normalizeNullableString(value: unknown, max = MAX_BANNER_TEXT_LENGTH) {
  const normalized = normalizeString(value, max);
  return normalized || null;
}

function normalizeHttpUrl(value: unknown) {
  const url = normalizeString(value, 2048);
  if (!url) return "";

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function normalizeBannerLink(value: unknown) {
  const link = normalizeString(value, 2048);
  if (!link) return null;

  if (link.startsWith("/") && !link.startsWith("//")) {
    return link;
  }

  try {
    const parsed = new URL(link);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function parseJsonObject(request: NextRequest) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeOrderIndex(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(9999, Math.floor(numeric)));
}

async function requireDashboardManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "sub-admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { admin, user };
}

function sanitizeBanner(body: Record<string, unknown>) {
  return {
    title: normalizeString(body.title),
    subtitle: normalizeNullableString(body.subtitle, 240),
    label: normalizeNullableString(body.label, 60),
    image_url: normalizeHttpUrl(body.image_url),
    link: normalizeBannerLink(body.link),
    is_continuous: Boolean(body.is_continuous),
    start_date: normalizeDate(body.start_date),
    end_date: normalizeDate(body.end_date),
    order_index: normalizeOrderIndex(body.order_index),
    is_active: body.is_active !== false,
  };
}

export async function GET() {
  const auth = await requireDashboardManager();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.admin
    .from("banners")
    .select(BANNER_COLUMNS)
    .order("order_index", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: data || [] }, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireDashboardManager();
  if ("error" in auth) return auth.error;

  const body = await parseJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
  }

  const payload = sanitizeBanner(body);

  if (!payload.title || !payload.image_url) {
    return NextResponse.json({ error: "제목과 이미지는 필수입니다." }, { status: 400 });
  }

  const { data, error } = await auth.admin
    .from("banners")
    .insert(payload)
    .select(BANNER_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidateTag(CACHE_TAGS.home, "max");
  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireDashboardManager();
  if ("error" in auth) return auth.error;

  const body = await parseJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const payload = sanitizeBanner(body);

  if (!id || !isSafeIdentifierParam(id)) {
    return NextResponse.json({ error: "배너 ID가 필요합니다." }, { status: 400 });
  }

  if (!payload.title || !payload.image_url) {
    return NextResponse.json({ error: "제목과 이미지는 필수입니다." }, { status: 400 });
  }

  const { data, error } = await auth.admin
    .from("banners")
    .update(payload)
    .eq("id", id)
    .select(BANNER_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidateTag(CACHE_TAGS.home, "max");
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireDashboardManager();
  if ("error" in auth) return auth.error;

  const body = await parseJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";

  if (!id || !isSafeIdentifierParam(id)) {
    return NextResponse.json({ error: "배너 ID가 필요합니다." }, { status: 400 });
  }

  const { error } = await auth.admin.from("banners").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidateTag(CACHE_TAGS.home, "max");
  return NextResponse.json({ success: true });
}
