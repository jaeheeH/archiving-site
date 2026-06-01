import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkGalleryOwnershipOrAdmin,
  normalizeGalleryDimension,
  normalizeGalleryEmbedding,
  normalizeGalleryRange,
  normalizeGalleryTags,
  normalizeGalleryText,
  normalizeGalleryTitle,
  normalizeGalleryUrl,
} from "@/lib/supabase/gallery-utils";
import {
  CACHE_TAGS,
  PUBLIC_API_CACHE_CONTROL,
  getGalleryDetailData,
} from "@/lib/public-data";
import { getErrorMessage } from "@/lib/error-message";
import { parsePositiveIntParam } from "@/lib/route-params";

interface Props {
  params: Promise<{ id: string }>;
}

const GALLERY_DASHBOARD_COLUMNS = `
  id,
  title,
  description,
  image_url,
  image_width,
  image_height,
  tags,
  category,
  range,
  gemini_description,
  gemini_tags,
  created_at
`;

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
 * GET /api/gallery/[id]
 * 갤러리 단일 조회
 * 권한: 모두 가능
 */
export async function GET(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const galleryId = parsePositiveIntParam(id);
    if (!galleryId) {
      return NextResponse.json({ error: "Invalid gallery id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);

    if (searchParams.get("dashboard") === "true") {
      const permCheck = await checkGalleryOwnershipOrAdmin(galleryId);
      if (!permCheck.authorized) {
        return permCheck.error!;
      }

      const adminClient = createAdminClient();
      const { data, error } = await adminClient
        .from("gallery")
        .select(GALLERY_DASHBOARD_COLUMNS)
        .eq("id", galleryId)
        .single();

      if (error) {
        console.error("❌ Gallery dashboard 조회 에러:", error);
      }

      if (error || !data) {
        return NextResponse.json(
          { error: "Gallery not found" },
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
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    const detail = await getGalleryDetailData(galleryId);

    if (!detail?.gallery) {
      return NextResponse.json(
        { error: "Gallery not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: detail.gallery,
        prevId: detail.prevId,
        nextId: detail.nextId,
      },
      {
        headers: {
          "Cache-Control": PUBLIC_API_CACHE_CONTROL,
        },
      }
    );
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ Gallery 조회 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/gallery/[id]
 * 갤러리 수정
 * 권한: 작성자, admin, sub-admin만
 */
export async function PATCH(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const galleryId = parsePositiveIntParam(id);
    if (!galleryId) {
      return NextResponse.json({ error: "Invalid gallery id" }, { status: 400 });
    }

    // 1. 권한 검증 (작성자 또는 관리자)
    const permCheck = await checkGalleryOwnershipOrAdmin(galleryId);
    if (!permCheck.authorized) {
      return permCheck.error!;
    }

    // 2. 요청 데이터 파싱
    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
    }

    // 3. 업데이트할 데이터 준비
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) {
      const title = normalizeGalleryTitle(body.title);
      if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
      updateData.title = title;
    }
    if (body.description !== undefined) updateData.description = normalizeGalleryText(body.description);
    if (body.image_url !== undefined) {
      const imageUrl = normalizeGalleryUrl(body.image_url);
      if (!imageUrl) {
        return NextResponse.json({ error: "Invalid image URL format" }, { status: 400 });
      }
      updateData.image_url = imageUrl;
    }
    if (body.image_width !== undefined) {
      const width = normalizeGalleryDimension(body.image_width);
      if (body.image_width !== null && body.image_width !== "" && !width) {
        return NextResponse.json({ error: "Invalid image width" }, { status: 400 });
      }
      updateData.image_width = width;
    }
    if (body.image_height !== undefined) {
      const height = normalizeGalleryDimension(body.image_height);
      if (body.image_height !== null && body.image_height !== "" && !height) {
        return NextResponse.json({ error: "Invalid image height" }, { status: 400 });
      }
      updateData.image_height = height;
    }
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags)) {
        return NextResponse.json({ error: "tags 값은 배열이어야 합니다" }, { status: 400 });
      }
      updateData.tags = normalizeGalleryTags(body.tags);
    }
    if (body.category !== undefined) updateData.category = normalizeGalleryText(body.category, 40);
    if (body.range !== undefined) {
      if (!Array.isArray(body.range)) {
        return NextResponse.json({ error: "range 값은 배열이어야 합니다" }, { status: 400 });
      }
      updateData.range = normalizeGalleryRange(body.range);
    }
    if (body.embedding !== undefined) {
      const embedding = normalizeGalleryEmbedding(body.embedding);
      if (body.embedding !== null && body.embedding !== "" && !embedding) {
        return NextResponse.json({ error: "Invalid embedding format" }, { status: 400 });
      }
      updateData.embedding = embedding;
    }
    if (body.gemini_description !== undefined) {
      updateData.gemini_description = normalizeGalleryText(body.gemini_description, 1500);
    }
    if (body.gemini_tags !== undefined) {
      if (!Array.isArray(body.gemini_tags)) {
        return NextResponse.json({ error: "gemini_tags 값은 배열이어야 합니다" }, { status: 400 });
      }
      updateData.gemini_tags = normalizeGalleryTags(body.gemini_tags);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "수정할 필드가 없습니다" }, { status: 400 });
    }

    // 4. Admin 클라이언트로 수정
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("gallery")
      .update(updateData)
      .eq("id", galleryId)
      .select(GALLERY_DASHBOARD_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    revalidateTag(CACHE_TAGS.gallery, "max");
    revalidateTag(CACHE_TAGS.home, "max");

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ Gallery 수정 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gallery/[id]
 * 갤러리 삭제
 * 권한: 작성자, admin, sub-admin만
 */
export async function DELETE(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const galleryId = parsePositiveIntParam(id);
    if (!galleryId) {
      return NextResponse.json({ error: "Invalid gallery id" }, { status: 400 });
    }

    // 1. 권한 검증
    const permCheck = await checkGalleryOwnershipOrAdmin(galleryId);
    if (!permCheck.authorized) {
      return permCheck.error!;
    }

    // 2. Admin 클라이언트로 삭제
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("gallery")
      .delete()
      .eq("id", galleryId);

    if (error) {
      throw error;
    }

    revalidateTag(CACHE_TAGS.gallery, "max");
    revalidateTag(CACHE_TAGS.home, "max");

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ Gallery 삭제 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
