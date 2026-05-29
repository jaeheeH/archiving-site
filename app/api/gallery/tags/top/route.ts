import { NextRequest, NextResponse } from "next/server";
import {
  PUBLIC_API_CACHE_CONTROL,
  getGalleryTopTags,
} from "@/lib/public-data";

/**
 * GET /api/gallery/tags/top
 * 현재 필터링된 결과 내에서 상위 태그들을 계산하여 반환합니다.
 * * [기능]
 * 1. 검색어 및 태그 필터 적용 (리스트 API와 동일한 로직)
 * 2. 아이템 내부 태그 중복 제거 (tags + gemini_tags 합침)
 * 3. 스마트 필터링:
 * - 이미 선택된 태그는 항상 표시 (해제할 수 있도록)
 * - 선택되지 않았는데 모든 결과에 포함된(변별력 없는) 태그는 숨김
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const selectedTags = searchParams.get("tags");
    const searchQuery = searchParams.get("search");

    const tags = await getGalleryTopTags(selectedTags || "", searchQuery || "");

    return NextResponse.json(
      { success: true, tags },
      {
        headers: {
          "Cache-Control": PUBLIC_API_CACHE_CONTROL,
        },
      }
    );

  } catch (error: any) {
    console.error("❌ 태그 집계 에러:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
