import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkReferenceEditPermission } from "@/lib/supabase/reference-utils";
import { CACHE_TAGS } from "@/lib/public-data";
import { getErrorMessage } from "@/lib/error-message";

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

function normalizeReferenceIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((id) => (typeof id === "number" || typeof id === "string" ? Number(id) : NaN))
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    )
  ).slice(0, 100);
}

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
    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
    }

    const ids = normalizeReferenceIds(body.ids);

    // 3. 요청 데이터 검증
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "ids must be a non-empty array" },
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

    revalidateTag(CACHE_TAGS.references, "max");
    revalidateTag(CACHE_TAGS.home, "max");

    return NextResponse.json({
      success: true,
      deleted: ids.length,
      message: `Successfully deleted ${ids.length} items`,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ Reference 일괄 삭제 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
