import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkGalleryEditPermission,
  normalizeGalleryDimension,
  normalizeGalleryEmbedding,
  normalizeGalleryRange,
  normalizeGalleryTags,
  normalizeGalleryText,
  normalizeGalleryTitle,
  normalizeGalleryUrl,
} from "@/lib/supabase/gallery-utils";
import {
  CACHE_TAGS,
  PUBLIC_API_CACHE_CONTROL,
  getGalleryPageData,
} from "@/lib/public-data";
import { getErrorMessage } from "@/lib/error-message";

const GALLERY_CREATE_COLUMNS = `
  id,
  title,
  description,
  image_url,
  image_width,
  image_height,
  tags,
  category,
  range,
  gemini_description,
  gemini_tags,
  created_at
`;

const MAX_GALLERY_LIMIT = 100;
const MAX_FILTER_LENGTH = 80;
const MAX_FILTER_TAGS = 10;
const MAX_FILTER_TAG_LENGTH = 40;

function normalizePositiveInt(value: string | null, fallback: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return fallback;
  return Math.min(Math.floor(numeric), max);
}

function normalizeFilterText(value = "", max = MAX_FILTER_LENGTH) {
  return value
    .trim()
    .slice(0, max)
    .replace(/[{}()[\]",%:*&|!']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFilterTags(tagsCsv = "") {
  return tagsCsv
    .split(",")
    .map((tag) => normalizeFilterText(tag, MAX_FILTER_TAG_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_FILTER_TAGS);
}

async function parseJsonObject(req: NextRequest) {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

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
    const page = normalizePositiveInt(searchParams.get("page"), 1, 10_000);
    const limit = normalizePositiveInt(searchParams.get("limit"), 10, MAX_GALLERY_LIMIT);
    const search = searchParams.get("search") || "";
    const tagsParam = searchParams.get("tags") || "";

    if (searchParams.get("dashboard") === "true") {
      const permCheck = await checkGalleryEditPermission();
      if (!permCheck.authorized) {
        return permCheck.error!;
      }

      const adminClient = createAdminClient();
      const offset = (page - 1) * limit;
      const safeSearch = normalizeFilterText(search);
      const filterTags = parseFilterTags(tagsParam);

      let query = adminClient
        .from("gallery")
        .select(GALLERY_CREATE_COLUMNS, { count: "planned" })
        .order("created_at", { ascending: false });

      if (safeSearch) {
        query = query.or(
          `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,gemini_description.ilike.%${safeSearch}%`
        );
      }

      for (const tag of filterTags) {
        query = query.or(`tags.cs.{${tag}},gemini_tags.cs.{${tag}}`);
      }

      const { data, error, count } = await query.range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return NextResponse.json(
        {
          success: true,
          data: data || [],
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
          },
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

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
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ Gallery 목록 조회 에러:", error);
    return NextResponse.json(
      { error: message },
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
    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
    }

    const title = normalizeGalleryTitle(body.title);
    const imageUrl = normalizeGalleryUrl(body.image_url);

    // 3. 필수 필드 확인
    if (!title || !imageUrl) {
      return NextResponse.json(
        { error: "Title and valid image_url are required" },
        { status: 400 }
      );
    }

    const normalizedEmbedding = normalizeGalleryEmbedding(body.embedding);
    if (body.embedding !== undefined && body.embedding !== null && !normalizedEmbedding) {
      return NextResponse.json({ error: "Invalid embedding format" }, { status: 400 });
    }

    // 4. Admin 클라이언트로 저장 (RLS 우회)
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("gallery")
      .insert({
        title,
        description: normalizeGalleryText(body.description),
        image_url: imageUrl,
        image_width: normalizeGalleryDimension(body.image_width),
        image_height: normalizeGalleryDimension(body.image_height),
        tags: normalizeGalleryTags(body.tags),
        category: normalizeGalleryText(body.category, 40),
        range: normalizeGalleryRange(body.range),
        author: permCheck.userId,
        embedding: normalizedEmbedding,
        gemini_description: normalizeGalleryText(body.gemini_description, 1500),
        gemini_tags: normalizeGalleryTags(body.gemini_tags),
        created_at: new Date().toISOString(),
      })
      .select(GALLERY_CREATE_COLUMNS)
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
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ Gallery 생성 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
