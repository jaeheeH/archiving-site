import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGalleryEditPermission } from "@/lib/supabase/gallery-utils";

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
    const supabase = await createClient();

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const tagsParam = searchParams.get("tags") || "";
    const offset = (page - 1) * limit;

    // 필터링할 태그 배열로 변환
    const filterTags = tagsParam
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    let query = supabase
      .from("gallery")
      .select(
        `
        id,
        title,
        description,
        image_url,
        image_width,
        image_height,
        created_at,
        tags,
        category,
        range,
        author,
        gemini_tags,
        gemini_description
      `,
        { count: "exact" }
      );

    // 검색어 적용 (fulltext search)
    if (search.trim()) {
      // to_tsquery를 사용한 검색 (다중 단어 AND 조건)
      const searchQuery = search
        .trim()
        .split(/\s+/)
        .map((word) => `${word}:*`)
        .join(" & ");

      query = query.textSearch("search_vector", searchQuery);
    }

    // 태그 필터 적용 (AND 조건: 모든 태그를 포함해야 함)
    if (filterTags.length > 0) {
      for (const tag of filterTags) {
        // tags 또는 gemini_tags 중 하나라도 해당 태그를 포함하면 OK
        query = query.or(`tags.cs.{${tag}},gemini_tags.cs.{${tag}}`);
      }
    }

    // 정렬 및 페이지네이션
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
      },
      filters: {
        search,
        tags: filterTags,
      },
    });
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