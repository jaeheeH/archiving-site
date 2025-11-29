import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

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
    const supabase = await createClient();

    const searchParams = req.nextUrl.searchParams;
    const selectedTags = searchParams.get("tags");
    const searchQuery = searchParams.get("search");

    // 1. URL 파라미터에서 선택된 태그 목록 파싱
    const tagsArray = selectedTags ? selectedTags.split(",").filter(t => t.trim()) : [];
    const selectedTagsSet = new Set(tagsArray);

    let query = supabase
      .from("gallery")
      .select("tags, gemini_tags, gemini_description");

    // 2. 태그 필터 적용 (AND 조건: 각 태그가 tags 또는 gemini_tags에 있어야 함)
    if (tagsArray.length > 0) {
      tagsArray.forEach(tag => {
         query = query.or(`tags.cs.{${tag}},gemini_tags.cs.{${tag}}`);
      });
    }

    // 3. 검색어 필터 적용 (설명, AI 태그, 사용자 태그 검색)
    if (searchQuery) {
       query = query.or(`gemini_description.ilike.%${searchQuery}%,gemini_tags.cs.{${searchQuery}},tags.cs.{${searchQuery}}`);
    }

    const { data: galleryItems, error } = await query;

    if (error) throw error;

    // 결과가 없으면 빈 배열 반환
    if (!galleryItems || galleryItems.length === 0) {
      return NextResponse.json({ success: true, tags: [] });
    }

    // 4. 태그 카운팅 (중복 제거 포함)
    const tagCount: Record<string, number> = {};
    const currentTotalCount = galleryItems.length;

    galleryItems.forEach((item) => {
      const uniqueItemTags = new Set<string>();

      // 사용자 태그 + AI 태그 모두 수집
      if (Array.isArray(item.tags)) {
        item.tags.forEach((tag: string) => tag && uniqueItemTags.add(tag));
      }
      if (Array.isArray(item.gemini_tags)) {
        item.gemini_tags.forEach((tag: string) => tag && uniqueItemTags.add(tag));
      }

      // 중복 제거된 태그들로 카운트 증가
      uniqueItemTags.forEach((tag) => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });

    // 5. 필터링 및 정렬 (스마트 필터 로직 적용)
    const topTags = Object.entries(tagCount)
    .filter(([tag, count]) => {
      // [조건 1] 이미 선택된 태그라면? -> 무조건 유지 (해제 가능해야 하므로)
      if (selectedTagsSet.has(tag)) return true;

      // [조건 2] 선택 안 된 태그인데 모든 결과에 다 붙어있다면? -> 숨김
      // ❌ 수정 전: if (currentTotalCount > 1 && count === currentTotalCount) return false;
      // ✅ 수정 후: 결과가 1개여도(count가 1이어도) 숨겨야 하므로 > 0 으로 변경
      if (currentTotalCount > 0 && count === currentTotalCount) return false;

      return true;
    })
    .sort((a, b) => b[1] - a[1]) 
    .slice(0, 10) 
    .map(([tag, count]) => ({ tag, count }));

    return NextResponse.json({ success: true, tags: topTags });

  } catch (error: any) {
    console.error("❌ 태그 집계 에러:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}