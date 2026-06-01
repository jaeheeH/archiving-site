import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkReferenceOwnershipOrAdmin,
  getPrimaryReferenceCategory,
  normalizeReferenceRange,
  normalizeReferenceText,
  normalizeReferenceTitle,
  normalizeReferenceUrl,
} from "@/lib/supabase/reference-utils";
import {
  CACHE_TAGS,
  PUBLIC_API_CACHE_CONTROL,
} from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import { getErrorMessage } from "@/lib/error-message";
import { parsePositiveIntParam } from "@/lib/route-params";

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
    const referenceId = parsePositiveIntParam(id);
    if (!referenceId) {
      return NextResponse.json({ error: "Invalid reference id" }, { status: 400 });
    }

    const supabase = createPublicClient();

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
        created_at,
        updated_at
      `
      )
      .eq("id", referenceId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Reference not found" },
        { status: 404 }
      );
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
    console.error("❌ Reference 조회 에러:", error);
    return NextResponse.json(
      { error: message },
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
    const referenceId = parsePositiveIntParam(id);
    if (!referenceId) {
      return NextResponse.json({ error: "Invalid reference id" }, { status: 400 });
    }

    // 요청 데이터 파싱
    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
    }

    // -----------------------------------------------------------
    // [CASE 1] 클릭 수 업데이트 (권한 검사 제외)
    // -----------------------------------------------------------
    if (body.clicks !== undefined) {
      if (typeof body.clicks !== "number" || !Number.isFinite(body.clicks) || body.clicks < 0) {
        return NextResponse.json({ error: "Invalid clicks value" }, { status: 400 });
      }

      const adminClient = createAdminClient();

      const { data: currentReference, error: readError } = await adminClient
        .from("references")
        .select("clicks")
        .eq("id", referenceId)
        .single();

      if (readError || !currentReference) {
        return NextResponse.json(
          { error: "Reference not found" },
          { status: 404 }
        );
      }

      const nextClicks = Number(currentReference.clicks || 0) + 1;

      const { data, error } = await adminClient
        .from("references")
        .update({ clicks: nextClicks })
        .eq("id", referenceId)
        .select("id, clicks")
        .single();

      if (error) throw error;
      
      return NextResponse.json(
        { success: true, data },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
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
      category,
      range,
    } = body;

    // 2. 업데이트할 데이터 준비
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) {
      const normalizedTitle = normalizeReferenceTitle(title);
      if (!normalizedTitle) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      updateData.title = normalizedTitle;
    }
    if (description !== undefined) {
      updateData.description = normalizeReferenceText(description);
    }
    if (url !== undefined) {
      const normalizedUrl = normalizeReferenceUrl(url);
      if (!normalizedUrl) {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 }
        );
      }
      updateData.url = normalizedUrl;
    }
    if (image_url !== undefined) {
      const normalizedImageUrl = normalizeReferenceUrl(image_url);
      if (!normalizedImageUrl) {
        return NextResponse.json({ error: "Invalid image URL format" }, { status: 400 });
      }
      updateData.image_url = normalizedImageUrl;
    }
    if (logo_url !== undefined) {
      const normalizedLogoUrl = normalizeReferenceUrl(logo_url);
      if (!normalizedLogoUrl) {
        return NextResponse.json({ error: "Invalid logo URL format" }, { status: 400 });
      }
      updateData.logo_url = normalizedLogoUrl;
    }
    if (range !== undefined) {
      const normalizedRange = normalizeReferenceRange(range);
      updateData.range = normalizedRange;
      updateData.category = getPrimaryReferenceCategory(normalizedRange, category);
    } else if (category !== undefined) {
      updateData.category = getPrimaryReferenceCategory(range, category);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "수정할 필드가 없습니다" }, { status: 400 });
    }
    
    // 내용 수정 시에만 updated_at 갱신
    updateData.updated_at = new Date().toISOString();

    // 3. Admin 클라이언트로 수정
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("references")
      .update(updateData)
      .eq("id", referenceId)
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
    console.error("❌ Reference 수정 에러:", error);
    return NextResponse.json(
      { error: message },
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
    const referenceId = parsePositiveIntParam(id);
    if (!referenceId) {
      return NextResponse.json({ error: "Invalid reference id" }, { status: 400 });
    }

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

    revalidateTag(CACHE_TAGS.references, "max");
    revalidateTag(CACHE_TAGS.home, "max");

    return NextResponse.json({
      success: true,
      message: "Reference deleted successfully",
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ Reference 삭제 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
