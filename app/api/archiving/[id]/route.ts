import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkArchivingOwnershipOrAdmin } from "@/lib/supabase/archiving-utils";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/archiving/[id]
 * 아카이빙 단일 조회
 * 권한: 모두 가능
 */
export async function GET(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("archiving")
      .select(
        `
        id,
        title,
        description,
        url,
        image_url,
        category,
        range,
        clicks,
        author,
        created_at,
        updated_at
      `
      )
      .eq("id", parseInt(id))
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Archiving not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("❌ Archiving 조회 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/archiving/[id]
 * 아카이빙 수정
 * 권한: 작성자, admin, sub_admin만
 * 
 * 요청 바디:
 * {
 *   "title": "제목",
 *   "description": "설명",
 *   "url": "https://...",
 *   "image_url": "이미지 URL",
 *   "category": "카테고리",
 *   "range": ["범주1", "범주2"]
 * }
 */
export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const archivingId = parseInt(id);

    // 1. 권한 검증 (작성자 또는 관리자)
    const permCheck = await checkArchivingOwnershipOrAdmin(archivingId);
    if (!permCheck.authorized) {
      return permCheck.error!;
    }

    // 2. 요청 데이터 파싱
    const body = await req.json();
    const {
      title,
      description,
      url,
      image_url,
      range,
    } = body;

    // 3. 업데이트할 데이터 준비
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (url !== undefined) {
      // URL 형식 검증
      try {
        new URL(url);
        updateData.url = url;
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 }
        );
      }
    }
    if (image_url !== undefined) updateData.image_url = image_url;
    if (range !== undefined) updateData.range = range;
    updateData.updated_at = new Date().toISOString();

    // 4. Admin 클라이언트로 수정
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("archiving")
      .update(updateData)
      .eq("id", archivingId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("❌ Archiving 수정 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/archiving/[id]
 * 아카이빙 삭제
 * 권한: 작성자, admin, sub_admin만
 */
export async function DELETE(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const archivingId = parseInt(id);

    // 1. 권한 검증
    const permCheck = await checkArchivingOwnershipOrAdmin(archivingId);
    if (!permCheck.authorized) {
      return permCheck.error!;
    }

    // 2. Admin 클라이언트로 삭제
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("archiving")
      .delete()
      .eq("id", archivingId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Archiving deleted successfully",
    });
  } catch (error: any) {
    console.error("❌ Archiving 삭제 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}