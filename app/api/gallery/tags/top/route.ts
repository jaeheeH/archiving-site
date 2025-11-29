import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

/**
 * GET /api/gallery/tags/top
 * 태그 조회 (필터용)
 * 권한: 모두 가능
 *
 * 쿼리 파라미터:
 * - limit: 가져올 태그 개수 (기본값: 전체, 0이면 전체)
 *
 * 응답:
 * {
 *   "success": true,
 *   "tags": [
 *     { "tag": "풍경", "count": 15 },
 *     { "tag": "바다", "count": 12 },
 *     ...
 *   ]
 * }
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit")) || 0; // 0 = 전체

    // 1. 모든 갤러리 아이템의 tags와 gemini_tags 조회
    const { data: galleryItems, error } = await supabase
      .from("gallery")
      .select("tags, gemini_tags");

    if (error) {
      throw error;
    }

    if (!galleryItems || galleryItems.length === 0) {
      return NextResponse.json({
        success: true,
        tags: [],
      });
    }

    // 2. 모든 태그를 합치고 개수 세기
    const tagCount: Record<string, number> = {};

    galleryItems.forEach((item) => {
      // tags 배열 처리
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach((tag: string) => {
          if (tag && typeof tag === "string") {
            tagCount[tag] = (tagCount[tag] || 0) + 1;
          }
        });
      }

      // gemini_tags 배열 처리
      if (item.gemini_tags && Array.isArray(item.gemini_tags)) {
        item.gemini_tags.forEach((tag: string) => {
          if (tag && typeof tag === "string") {
            tagCount[tag] = (tagCount[tag] || 0) + 1;
          }
        });
      }
    });

    // 3. 태그 정렬 및 제한
    let topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({
        tag,
        count,
      }));

    // limit이 0보다 크면 해당 개수만큼만 반환
    if (limit > 0) {
      topTags = topTags.slice(0, limit);
    }

    return NextResponse.json({
      success: true,
      tags: topTags,
    });
  } catch (error: any) {
    console.error("❌ 상위 태그 조회 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}