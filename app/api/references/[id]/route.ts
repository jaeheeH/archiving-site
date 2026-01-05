import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkReferenceOwnershipOrAdmin } from "@/lib/supabase/reference-utils";

// 캐싱 방지 (항상 최신 데이터 로드)
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/references/[id]
 * 레퍼런스 단일 조회
 * 권한: 모두 가능
 */
export async function GET(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("references")
      .select(
        `
        id,
        title,
        description,
        url,
        image_url,
        logo_url,
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
        { error: "Reference not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("❌ Reference 조회 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/references/[id]
 * 레퍼런스 수정
 * 1. clicks 업데이트: 누구나 가능 (권한 체크 건너뜀)
 * 2. 정보 수정: 작성자, admin, sub_admin만 가능
 */
export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const referenceId = parseInt(id);

    // 요청 데이터 파싱
    const body = await req.json();

    // -----------------------------------------------------------
    // [CASE 1] 클릭 수 업데이트 (권한 검사 제외)
    // -----------------------------------------------------------
    if (body.clicks !== undefined) {
      // Admin 권한으로 강제 업데이트
      const adminClient = createAdminClient();
      
      const { data, error } = await adminClient
        .from("references")
        .update({ clicks: body.clicks }) // clicks만 수정
        .eq("id", referenceId)
        .select()
        .single();

      if (error) throw error;
      
      return NextResponse.json({ success: true, data });
    }

    // -----------------------------------------------------------
    // [CASE 2] 일반 정보 수정 (제목, URL 등) -> 권한 검사 필수
    // -----------------------------------------------------------

    // 1. 권한 검증 (작성자 또는 관리자)
    const permCheck = await checkReferenceOwnershipOrAdmin(referenceId);
    if (!permCheck.authorized) {
      return permCheck.error!;
    }

    const {
      title,
      description,
      url,
      image_url,
      logo_url,
      range,
    } = body;

    // 2. 업데이트할 데이터 준비
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (url !== undefined) {
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
    if (logo_url !== undefined) updateData.logo_url = logo_url;
    if (range !== undefined) updateData.range = range;
    
    // 내용 수정 시에만 updated_at 갱신
    updateData.updated_at = new Date().toISOString();

    // 3. Admin 클라이언트로 수정
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("references")
      .update(updateData)
      .eq("id", referenceId)
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
    console.error("❌ Reference 수정 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/references/[id]
 * 레퍼런스 삭제
 * 권한: 작성자, admin, sub_admin만
 */
export async function DELETE(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const referenceId = parseInt(id);

    // 1. 권한 검증
    const permCheck = await checkReferenceOwnershipOrAdmin(referenceId);
    if (!permCheck.authorized) {
      return permCheck.error!;
    }

    // 2. Admin 클라이언트로 삭제
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("references")
      .delete()
      .eq("id", referenceId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Reference deleted successfully",
    });
  } catch (error: any) {
    console.error("❌ Reference 삭제 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}