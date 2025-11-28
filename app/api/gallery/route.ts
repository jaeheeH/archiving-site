import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGalleryEditPermission } from "@/lib/supabase/gallery-utils";

/**
 * GET /api/gallery
 * 갤러리 목록 조회 (페이지네이션)
 * 권한: 모두 가능
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // 전체 개수 조회
    const { count } = await supabase
      .from("gallery")
      .select("*", { count: "exact", head: true });

    // 데이터 조회
    const { data, error } = await supabase
      .from("gallery")
      .select(
        `
        id,
        title,
        description,
        image_url,
        created_at,
        tags,
        category,
        range,
        author,
        gemini_tags,
        gemini_description
      `
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

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