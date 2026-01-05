import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkReferenceEditPermission } from "@/lib/supabase/reference-utils";

/**
 * DELETE /api/references/bulk
 * 레퍼런스 일괄 삭제
 * 권한: admin, sub_admin만
 * 
 * 요청 바디:
 * {
 *   "ids": [1, 2, 3, ...]  (레퍼런스 ID 배열)
 * }
 * 
 * 응답:
 * {
 *   "success": true,
 *   "deleted": 3,
 *   "failed": 0
 * }
 */
export async function DELETE(req: NextRequest) {
  try {
    // 1. 권한 검증
    const permCheck = await checkReferenceEditPermission();
    if (!permCheck.authorized) {
      return permCheck.error!;
    }

    // 2. 요청 데이터 파싱
    const body = await req.json();
    const { ids } = body;

    // 3. 요청 데이터 검증
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids must be a non-empty array" },
        { status: 400 }
      );
    }

    // 4. ID 배열 검증 (숫자만)
    if (!ids.every((id: any) => typeof id === "number" || typeof id === "string")) {
      return NextResponse.json(
        { error: "All ids must be numbers" },
        { status: 400 }
      );
    }

    // 5. Admin 클라이언트로 일괄 삭제
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("references")
      .delete()
      .in("id", ids);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      deleted: ids.length,
      message: `Successfully deleted ${ids.length} items`,
    });
  } catch (error: any) {
    console.error("❌ Reference 일괄 삭제 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}