import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/public-data";
import { getErrorMessage } from "@/lib/error-message";

const MAX_TEXT_LENGTH = 500;
const MAX_SCRIPT_LENGTH = 10_000;
const VALID_LANGUAGES = new Set(["ko", "ko_KR", "en", "ja", "zh"]);
const VALID_OG_TYPES = new Set(["website", "article"]);
const VALID_TWITTER_CARDS = new Set(["summary", "summary_large_image"]);
const VALID_SCHEMA_TYPES = new Set(["Organization", "Person", "WebSite"]);
const SITE_SETTINGS_ADMIN_COLUMNS = `
  site_name,
  site_description,
  site_keywords,
  site_language,
  og_title,
  og_description,
  og_image,
  og_type,
  twitter_card_type,
  twitter_title,
  twitter_description,
  twitter_image,
  favicon_url,
  apple_touch_icon_url,
  android_icon_192_url,
  android_icon_512_url,
  robots_allow,
  google_verification,
  naver_verification,
  sitemap_revalidate,
  schema_type,
  organization_name,
  logo_url,
  ga4_id,
  gtm_id,
  custom_scripts,
  theme_color,
  canonical_enabled
`;

function normalizeString(value: unknown, max = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function normalizeRequiredString(value: unknown, fallback: string, max = MAX_TEXT_LENGTH) {
  return normalizeString(value, max) || fallback;
}

function normalizeUrl(value: unknown) {
  const url = normalizeString(value, 2048);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeKeywords(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((keyword): keyword is string => typeof keyword === "string")
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .map((keyword) => keyword.slice(0, 50))
    )
  ).slice(0, 30);
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeNumber(value: unknown, fallback: number, allowed: number[]) {
  const numeric = Number(value);
  return allowed.includes(numeric) ? numeric : fallback;
}

function normalizeEnum(value: unknown, allowed: Set<string>, fallback: string) {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

function normalizeThemeColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#1570EF";
}

function normalizeGa4Id(value: unknown) {
  const id = normalizeString(value, 40);
  return id && /^G-[A-Z0-9-]+$/i.test(id) ? id.toUpperCase() : null;
}

function normalizeGtmId(value: unknown) {
  const id = normalizeString(value, 40);
  return id && /^GTM-[A-Z0-9-]+$/i.test(id) ? id.toUpperCase() : null;
}

function sanitizeSiteSettings(body: Record<string, unknown>) {
  return {
    site_name: normalizeRequiredString(body.site_name, "Archiving", 120),
    site_description: normalizeString(body.site_description, 300),
    site_keywords: normalizeKeywords(body.site_keywords),
    site_language: normalizeEnum(body.site_language, VALID_LANGUAGES, "ko"),
    og_title: normalizeString(body.og_title, 120),
    og_description: normalizeString(body.og_description, 300),
    og_image: normalizeUrl(body.og_image),
    og_type: normalizeEnum(body.og_type, VALID_OG_TYPES, "website"),
    twitter_card_type: normalizeEnum(body.twitter_card_type, VALID_TWITTER_CARDS, "summary_large_image"),
    twitter_title: normalizeString(body.twitter_title, 120),
    twitter_description: normalizeString(body.twitter_description, 300),
    twitter_image: normalizeUrl(body.twitter_image),
    favicon_url: normalizeUrl(body.favicon_url),
    apple_touch_icon_url: normalizeUrl(body.apple_touch_icon_url),
    android_icon_192_url: normalizeUrl(body.android_icon_192_url),
    android_icon_512_url: normalizeUrl(body.android_icon_512_url),
    robots_allow: normalizeBoolean(body.robots_allow, true),
    google_verification: normalizeString(body.google_verification, 200),
    naver_verification: normalizeString(body.naver_verification, 200),
    sitemap_revalidate: normalizeNumber(body.sitemap_revalidate, 3600, [3600, 21600, 43200, 86400]),
    schema_type: normalizeEnum(body.schema_type, VALID_SCHEMA_TYPES, "Organization"),
    organization_name: normalizeString(body.organization_name, 120),
    logo_url: normalizeUrl(body.logo_url),
    ga4_id: normalizeGa4Id(body.ga4_id),
    gtm_id: normalizeGtmId(body.gtm_id),
    custom_scripts: normalizeString(body.custom_scripts, MAX_SCRIPT_LENGTH),
    theme_color: normalizeThemeColor(body.theme_color),
    canonical_enabled: normalizeBoolean(body.canonical_enabled, true),
  };
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

async function requireSiteSettingsAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      adminClient: null,
    };
  }

  const adminClient = createAdminClient();
  const { data: userData } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userData || userData.role !== "admin") {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      adminClient: null,
    };
  }

  return {
    authorized: true,
    response: null,
    userId: user.id,
    adminClient,
  };
}

/**
 * GET /api/settings/site
 * 사이트 설정 조회
 * 권한: admin만
 */
export async function GET() {
  try {
    const auth = await requireSiteSettingsAdmin();
    if (!auth.authorized) return auth.response!;

    const { data, error } = await auth.adminClient!
      .from("site_settings")
      .select(SITE_SETTINGS_ADMIN_COLUMNS)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ Site settings 조회 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/site
 * 사이트 설정 업데이트
 * 권한: admin, sub-admin만
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireSiteSettingsAdmin();
    if (!auth.authorized) return auth.response!;
    const adminClient = auth.adminClient!;

    // 2. 요청 데이터 파싱
    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
    }

    const payload = sanitizeSiteSettings(body);

    // 3. 기존 설정 확인
    const { data: existingSettings } = await adminClient
      .from("site_settings")
      .select("id")
      .single();

    if (existingSettings) {
      // 업데이트
      const { data, error } = await adminClient
        .from("site_settings")
        .update({
          ...payload,
          updated_by: auth.userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSettings.id)
        .select(SITE_SETTINGS_ADMIN_COLUMNS)
        .single();

      if (error) throw error;

      revalidateTag(CACHE_TAGS.siteSettings, "max");

      return NextResponse.json({
        success: true,
        data,
      });
    } else {
      // 새로 삽입
      const { data, error } = await adminClient
        .from("site_settings")
        .insert({
          ...payload,
          updated_by: auth.userId,
        })
        .select(SITE_SETTINGS_ADMIN_COLUMNS)
        .single();

      if (error) throw error;

      revalidateTag(CACHE_TAGS.siteSettings, "max");

      return NextResponse.json({
        success: true,
        data,
      });
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ Site settings 저장 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
