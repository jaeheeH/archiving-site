import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { CACHE_TAGS } from "@/lib/public-data";
import { isSafeIdentifierParam } from "@/lib/route-params";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BANNER_COLUMNS, bannerDate, bannerImage, bannerLink } from '@/lib/banners';
import { dashboardPeriod } from '@/lib/dashboard-metrics';

const MAX_BANNER_TEXT_LENGTH = 160;

function normalizeString(value: unknown, max = MAX_BANNER_TEXT_LENGTH) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function normalizeNullableString(value: unknown, max = MAX_BANNER_TEXT_LENGTH) {
  const normalized = normalizeString(value, max);
  return normalized || null;
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
    image_url: bannerImage(body.image_url),
    link: bannerLink(body.link),
    is_continuous: Boolean(body.is_continuous),
    start_date: bannerDate(body.start_date),
    end_date: bannerDate(body.end_date, true),
    order_index: normalizeOrderIndex(body.order_index),
    is_active: body.is_active !== false,
    ...(body.kind !== undefined ? { kind: body.kind } : {}),
  };
}

function validateBanner(body: Record<string, unknown>, payload: ReturnType<typeof sanitizeBanner>) {
  if (!payload.title || !payload.image_url) return '제목과 올바른 이미지 주소는 필수입니다.';
  if (body.kind !== undefined && body.kind !== 'ad' && body.kind !== 'link') return '배너 유형은 광고 또는 일반 링크를 선택해주세요.';
  if (body.link && !payload.link) return '연결 주소는 사이트 내부 경로나 http(s) 주소를 사용해주세요.';
  if ((body.start_date && !payload.start_date) || (body.end_date && !payload.end_date)) return '노출 날짜를 확인해주세요.';
  if (!payload.is_continuous && payload.start_date && payload.end_date && payload.start_date > payload.end_date) return '종료일은 시작일 이후여야 합니다.';
  return null;
}

export async function GET(request: NextRequest) {
  const auth = await requireDashboardManager();
  if ("error" in auth) return auth.error;

  const days = Number(request.nextUrl.searchParams.get('days')) === 7 ? 7 : 30;
  const period = dashboardPeriod(days);
  const [{ data, error }, analytics] = await Promise.all([
    auth.admin.from('banners').select(BANNER_COLUMNS).order('order_index').order('created_at').order('id'),
    auth.admin.rpc('banner_stats', { p_start: period.start, p_end: period.now }),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: data || [], stats: analytics.error ? null : analytics.data, statsError: analytics.error ? '배너 통계를 불러오지 못했습니다.' : null }, {
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

  const validation = validateBanner(body, payload);
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });

  const { data, error } = await auth.admin
    .from("banners")
    .insert(payload)
    .select(BANNER_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidateTag(CACHE_TAGS.home, { expire: 0 });
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

  const validation = validateBanner(body, payload);
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });

  const { data, error } = await auth.admin
    .from("banners")
    .update(payload)
    .eq("id", id)
    .select(BANNER_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidateTag(CACHE_TAGS.home, { expire: 0 });
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

  revalidateTag(CACHE_TAGS.home, { expire: 0 });
  return NextResponse.json({ success: true });
}
