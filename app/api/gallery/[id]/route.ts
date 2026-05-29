import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGalleryOwnershipOrAdmin } from "@/lib/supabase/gallery-utils";
import {
  CACHE_TAGS,
  PUBLIC_API_CACHE_CONTROL,
  getGalleryDetailData,
} from "@/lib/public-data";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/gallery/[id]
 * 갤러리 단일 조회
 * 권한: 모두 가능
 */
export async function GET(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const galleryId = parseInt(id);
    const { searchParams } = new URL(req.url);

    if (searchParams.get("dashboard") === "true") {
      const permCheck = await checkGalleryOwnershipOrAdmin(galleryId);
      if (!permCheck.authorized) {
        return permCheck.error!;
      }

      const adminClient = createAdminClient();
      const { data, error } = await adminClient
        .from("gallery")
        .select("*")
        .eq("id", galleryId)
        .single();

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
      },
      {
        headers: {
          "Cache-Control": PUBLIC_API_CACHE_CONTROL,
        },
      }
    );
  } catch (error: any) {
    console.error("❌ Gallery 조회 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
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
    const galleryId = parseInt(id);

    // 1. 권한 검증 (작성자 또는 관리자)
    const permCheck = await checkGalleryOwnershipOrAdmin(galleryId);
    if (!permCheck.authorized) {
      return permCheck.error!;
    }

    // 2. 요청 데이터 파싱
    const body = await req.json();
    const {
      title,
      description,
      image_url,
      image_width,
      image_height,
      tags,
      category,
      range,
      embedding,
      gemini_description,
      gemini_tags,
    } = body;

    // 3. 업데이트할 데이터 준비
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (image_width !== undefined) updateData.image_width = image_width;
    if (image_height !== undefined) updateData.image_height = image_height;
    if (tags !== undefined) updateData.tags = tags;
    if (category !== undefined) updateData.category = category;
    if (range !== undefined) updateData.range = range;
    if (embedding !== undefined) updateData.embedding = embedding;
    if (gemini_description !== undefined) updateData.gemini_description = gemini_description;
    if (gemini_tags !== undefined) updateData.gemini_tags = gemini_tags;

    // 4. Admin 클라이언트로 수정
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("gallery")
      .update(updateData)
      .eq("id", galleryId)
      .select()
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
  } catch (error: any) {
    console.error("❌ Gallery 수정 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
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
    const galleryId = parseInt(id);

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
  } catch (error: any) {
    console.error("❌ Gallery 삭제 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
