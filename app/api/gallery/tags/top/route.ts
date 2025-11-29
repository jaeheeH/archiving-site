import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

/**
 * GET /api/gallery/tags/top
 * 상위 10개 태그 조회 (필터용)
 * 권한: 모두 가능
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

    // 3. 상위 10개 태그 추출
    const topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({
        tag,
        count,
      }));

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