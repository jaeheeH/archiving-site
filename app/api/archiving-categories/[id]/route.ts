import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkArchivingEditPermission } from "@/lib/supabase/archiving-utils";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/archiving-categories/[id]
 * 아카이빙 범주 단일 조회
 * 권한: 모두 가능
 */
export async function GET(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("archiving_categories")
      .select("id, name, description, created_at")
      .eq("id", parseInt(id))
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("❌ 아카이빙 범주 조회 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/archiving-categories/[id]
 * 아카이빙 범주 수정
 * 권한: admin, sub_admin만
 * 
 * 요청 바디:
 * {
 *   "name": "수정된 범주명",
 *   "description": "수정된 설명"
 * }
 */
export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);

    // 1. 권한 검증
    const permCheck = await checkArchivingEditPermission();
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

    // 4. Admin 클라이언트로 수정
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("archiving_categories")
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", categoryId)
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

    if (!data) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("❌ 아카이빙 범주 수정 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/archiving-categories/[id]
 * 아카이빙 범주 삭제
 * 권한: admin, sub_admin만
 */
export async function DELETE(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);

    // 1. 권한 검증
    const permCheck = await checkArchivingEditPermission();
    if (!permCheck.authorized) {
      return permCheck.error!;
    }

    // 2. Admin 클라이언트로 삭제
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("archiving_categories")
      .delete()
      .eq("id", categoryId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error: any) {
    console.error("❌ 아카이빙 범주 삭제 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}