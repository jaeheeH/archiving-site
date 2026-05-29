import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGalleryEditPermission } from "@/lib/supabase/gallery-utils";
import {
  CACHE_TAGS,
  PUBLIC_API_CACHE_CONTROL,
  getGalleryPageData,
} from "@/lib/public-data";

/**
 * GET /api/gallery
 * 갤러리 목록 조회 (페이지네이션 + 검색 + 필터)
 * 권한: 모두 가능
 * 
 * 쿼리 파라미터:
 * - page: 페이지 번호 (기본값: 1)
 * - limit: 페이지당 개수 (기본값: 10)
 * - search: 검색어 (선택)
 * - tags: 필터링할 태그 (쉼표 구분, AND 조건)
 * 
 * 예시:
 * /api/gallery?page=1&limit=36&search=바다&tags=풍경,바다
 */
export async function GET(req: NextRequest) {
  try {
    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const tagsParam = searchParams.get("tags") || "";

    const result = await getGalleryPageData(page, limit, search, tagsParam);

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      {
        headers: {
          "Cache-Control": PUBLIC_API_CACHE_CONTROL,
        },
      },
    );
  } catch (error: any) {
    console.error("❌ Gallery 목록 조회 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gallery
 * 갤러리 아이템 생성
 * 권한: admin, sub-admin, editor만
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 권한 검증
    const permCheck = await checkGalleryEditPermission();
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

    // 3. 필수 필드 확인
    if (!title || !image_url) {
      return NextResponse.json(
        { error: "Title and image_url are required" },
        { status: 400 }
      );
    }

    // 4. Admin 클라이언트로 저장 (RLS 우회)
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("gallery")
      .insert({
        title,
        description: description || null,
        image_url,
        image_width: image_width || null,        
        image_height: image_height || null,     
        tags: tags || [],
        category: category || null,
        range: range || [],
        author: permCheck.userId,
        embedding: embedding || null,
        gemini_description: gemini_description || null,
        gemini_tags: gemini_tags || [],
        created_at: new Date().toISOString(),
      })
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
    console.error("❌ Gallery 생성 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
