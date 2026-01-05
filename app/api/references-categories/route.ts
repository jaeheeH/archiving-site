import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkReferenceEditPermission } from "@/lib/supabase/reference-utils";

/**
 * GET /api/references-categories
 * 레퍼런스 범주 목록 조회
 * 권한: 모두 가능
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("reference_categories")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("❌ 레퍼런스 범주 조회 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
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
    const body = await req.json();
    const { name, description } = body;

    // 3. 필수 필드 확인
    if (!name || name.trim().length === 0) {
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
        name: name.trim(),
        description: description?.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
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

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("❌ 레퍼런스 범주 생성 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}