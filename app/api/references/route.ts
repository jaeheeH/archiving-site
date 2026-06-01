import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkReferenceEditPermission,
  getPrimaryReferenceCategory,
  normalizeReferenceRange,
  normalizeReferenceText,
  normalizeReferenceTitle,
  normalizeReferenceUrl,
} from "@/lib/supabase/reference-utils";
import {
  CACHE_TAGS,
  PUBLIC_API_CACHE_CONTROL,
  getReferencesListData,
} from "@/lib/public-data";
import { getErrorMessage } from "@/lib/error-message";

const REFERENCE_WRITE_COLUMNS =
  "id, title, description, url, image_url, logo_url, category, range, clicks, created_at, updated_at";

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

/**
 * GET /api/references
 * 레퍼런스 목록 조회 (페이지네이션 + 필터링 + 정렬)
 * 권한: 모두 가능
 */
export async function GET(req: NextRequest) {
  try {
    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const category = searchParams.get("category");
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const search = searchParams.get("search");

    const result = await getReferencesListData(
      page,
      limit,
      category || "",
      sort,
      order,
      search || ""
    );

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      {
        headers: {
          "Cache-Control": PUBLIC_API_CACHE_CONTROL,
        },
      }
    );
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ Reference 목록 조회 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/references
 * 레퍼런스 아이템 생성
 * 권한: admin, sub_admin만
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 권한 검증
    const permCheck = await checkReferenceEditPermission();
    if (!permCheck.authorized) {
      return permCheck.error!;
    }

    // 2. 요청 데이터 파싱
    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
    }

    const {
      title,
      description,
      url,
      image_url,
      logo_url,
      category,
      range,
    } = body;

    const normalizedTitle = normalizeReferenceTitle(title);
    const normalizedDescription = normalizeReferenceText(description);
    const normalizedUrl = normalizeReferenceUrl(url);
    const normalizedImageUrl = normalizeReferenceUrl(image_url);
    const normalizedLogoUrl = normalizeReferenceUrl(logo_url);
    const normalizedRange = normalizeReferenceRange(range);

    // 3. 필수 필드 확인
    if (
      !normalizedTitle ||
      !normalizedUrl ||
      !normalizedImageUrl ||
      !normalizedLogoUrl ||
      normalizedRange.length === 0
    ) {
      return NextResponse.json(
        { error: "title, url, image_url, logo_url, and range are required" },
        { status: 400 }
      );
    }

    // 5. Admin 클라이언트로 저장 (RLS 우회)
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("references")
      .insert({
        title: normalizedTitle,
        description: normalizedDescription,
        url: normalizedUrl,
        image_url: normalizedImageUrl,
        logo_url: normalizedLogoUrl,
        category: getPrimaryReferenceCategory(normalizedRange, category),
        range: normalizedRange,
        clicks: 0,
        author: permCheck.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(REFERENCE_WRITE_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    revalidateTag(CACHE_TAGS.references, "max");
    revalidateTag(CACHE_TAGS.home, "max");

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ Reference 생성 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
