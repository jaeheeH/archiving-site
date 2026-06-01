import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkReferenceEditPermission } from "@/lib/supabase/reference-utils";
import {
  CACHE_TAGS,
  PUBLIC_API_CACHE_CONTROL,
} from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import { getErrorMessage } from "@/lib/error-message";

const REFERENCE_CATEGORY_COLUMNS = "id, name, description, created_at";

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

function normalizeCategoryText(value: unknown, max = 80) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * GET /api/references-categories
 * 레퍼런스 범주 목록 조회
 * 권한: 모두 가능
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("reference_categories")
      .select(REFERENCE_CATEGORY_COLUMNS)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        headers: {
          "Cache-Control": PUBLIC_API_CACHE_CONTROL,
        },
      }
    );
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ 레퍼런스 범주 조회 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/references-categories
 * 레퍼런스 범주 생성
 * 권한: admin, sub_admin만
 * 
 * 요청 바디:
 * {
 *   "name": "범주명 (필수)",
 *   "description": "설명 (선택)"
 * }
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

    const name = normalizeCategoryText(body.name);
    const description = normalizeCategoryText(body.description, 500);

    // 3. 필수 필드 확인
    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    // 4. Admin 클라이언트로 저장
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("reference_categories")
      .insert({
        name,
        description: description || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(REFERENCE_CATEGORY_COLUMNS)
      .single();

    if (error) {
      // 중복 name 에러
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "이미 존재하는 범주명입니다." },
          { status: 409 }
        );
      }
      throw error;
    }

    revalidateTag(CACHE_TAGS.references, "max");

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ 레퍼런스 범주 생성 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
