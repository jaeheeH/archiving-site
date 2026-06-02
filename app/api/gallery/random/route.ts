import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { getErrorMessage } from "@/lib/error-message";
import { PUBLIC_API_CACHE_CONTROL } from "@/lib/public-data";

const RANDOM_GALLERY_COLUMNS = `
  id,
  title,
  description,
  image_url,
  thumbnail_url,
  created_at,
  tags,
  category,
  range,
  gemini_tags,
  gemini_description
`;

const DEBUG_API_LOGS = process.env.DEBUG_API_LOGS === "true";

function debugLog(...args: unknown[]) {
  if (DEBUG_API_LOGS) console.info(...args);
}

function jsonWithPublicCache(body: Record<string, unknown>) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": PUBLIC_API_CACHE_CONTROL,
    },
  });
}

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 10;
  return Math.min(parsed, 50);
}

function stripInternalGalleryFields(items: unknown) {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const source = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      id: source.id,
      title: source.title,
      description: source.description,
      image_url: source.image_url,
      thumbnail_url: source.thumbnail_url,
      created_at: source.created_at,
      tags: source.tags,
      category: source.category,
      range: source.range,
      gemini_tags: source.gemini_tags,
      gemini_description: source.gemini_description,
    };
  });
}

/**
 * GET /api/gallery/random
 * 갤러리 랜덤 조회
 * 권한: 모두 가능
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createPublicClient();

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(req.url);
    const limit = normalizeLimit(searchParams.get("limit"));

    // 랜덤 조회 (PostgreSQL의 RANDOM() 사용)
    const { data, error } = await supabase.rpc("get_random_gallery", {
      limit_count: limit,
    });

    if (error) {
      // RPC가 없으면 대체 방식 사용
      debugLog("Random gallery RPC unavailable; using bounded fallback");

      const fallbackLimit = Math.min(Math.max(limit * 5, limit), 100);
      const { count, error: countError } = await supabase
        .from("gallery")
        .select("id", { count: "estimated", head: true });

      if (countError) {
        throw countError;
      }

      if (!count) {
        return jsonWithPublicCache({
          success: true,
          data: [],
        });
      }

      const maxOffset = Math.max(count - fallbackLimit, 0);
      const randomOffset = Math.floor(Math.random() * (maxOffset + 1));

      const { data: sampleData, error: selectError } = await supabase
        .from("gallery")
        .select(RANDOM_GALLERY_COLUMNS)
        .order("created_at", { ascending: false })
        .range(randomOffset, randomOffset + fallbackLimit - 1);

      if (selectError) {
        throw selectError;
      }

      // 랜덤으로 섞기
      const shuffled = (sampleData || [])
        .sort(() => Math.random() - 0.5)
        .slice(0, limit);

      return jsonWithPublicCache({
        success: true,
        data: shuffled,
      });
    }

    return jsonWithPublicCache({
      success: true,
      data: stripInternalGalleryFields(data),
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ Gallery 랜덤 조회 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
