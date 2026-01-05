import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkReferenceEditPermission } from "@/lib/supabase/reference-utils";

/**
 * GET /api/references
 * 레퍼런스 목록 조회 (페이지네이션 + 필터링 + 정렬)
 * 권한: 모두 가능
 * 
 * 쿼리 파라미터:
 * - page: 페이지 번호 (기본값: 1)
 * - limit: 페이지당 개수 (기본값: 10)
 * - category: 카테고리로 필터
 * - sort: 정렬 기준 (created_at, clicks, title, 기본값: created_at)
 * - order: 정렬 순서 (asc, desc, 기본값: desc)
 * - search: 제목/설명 검색
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    const category = searchParams.get("category");
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const search = searchParams.get("search");

    // 쿼리 빌더
    let query = supabase
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
      `,
        { count: "exact" }
      );

    // 범주 필터 (range 배열에서 해당 값 포함하는 항목 검색)
    if (category) {
      query = query.filter("range", "cs", `{"${category}"}`);
    }

    // 검색 필터 (제목 또는 설명)
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // 정렬
    const validSortFields = ["created_at", "clicks", "title"];
    const sortField = validSortFields.includes(sort) ? sort : "created_at";
    query = query.order(sortField, { ascending: order === "asc" });

    // 페이지네이션
    query = query.range(offset, offset + limit - 1);

    // 데이터 조회
    const { data, count, error } = await query;

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
    });
  } catch (error: any) {
    console.error("❌ Reference 목록 조회 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/references
 * 레퍼런스 아이템 생성
 * 권한: admin, sub_admin만
 * 
 * 요청 바디:
 * {
 *   "title": "제목 (필수)",
 *   "description": "설명 (선택)",
 *   "url": "https://... (필수)",
 *   "image_url": "이미지 URL (필수)",
 *   "logo_url": "로고 URL (필수)",
 *   "category": "카테고리 (선택)",
 *   "range": ["범주1", "범주2"] (선택)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 권한 검증
    const permCheck = await checkReferenceEditPermission();
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
      logo_url,
      range,
    } = body;

    // 3. 필수 필드 확인
    if (!title || !url || !image_url || !logo_url) {
      return NextResponse.json(
        { error: "title, url, image_url, and logo_url are required" },
        { status: 400 }
      );
    }

    // 4. URL 형식 검증
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // 5. Admin 클라이언트로 저장 (RLS 우회)
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("references")
      .insert({
        title,
        description: description || null,
        url,
        image_url,
        logo_url,
        range: range || [],
        clicks: 0,
        author: permCheck.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
    console.error("❌ Reference 생성 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}