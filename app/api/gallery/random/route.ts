import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/gallery/random
 * 갤러리 랜덤 조회
 * 권한: 모두 가능
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // 랜덤 조회 (PostgreSQL의 RANDOM() 사용)
    const { data, error } = await supabase.rpc("get_random_gallery", {
      limit_count: limit,
    });

    if (error) {
      // RPC가 없으면 대체 방식 사용
      console.warn("❌ RPC 함수가 없습니다. 대체 방식 사용");
      
      // 전체 갤러리 조회 후 클라이언트에서 랜덤 선택
      const { data: allData, error: selectError } = await supabase
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
        );

      if (selectError) {
        throw selectError;
      }

      // 랜덤으로 섞기
      const shuffled = (allData || [])
        .sort(() => Math.random() - 0.5)
        .slice(0, limit);

      return NextResponse.json({
        success: true,
        data: shuffled,
      });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    console.error("❌ Gallery 랜덤 조회 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}