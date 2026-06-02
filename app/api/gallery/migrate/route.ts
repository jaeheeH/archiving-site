import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGalleryEditPermission } from "@/lib/supabase/gallery-utils";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getErrorMessage } from "@/lib/error-message";
import { CACHE_TAGS } from "@/lib/public-data";
import { generateGeminiTextEmbedding } from "@/lib/gemini-embedding";

type ImageAnalysisData = {
  category?: unknown;
  summary?: string;
  visual_detail?: string;
  tags?: unknown;
};

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");
const DEBUG_API_LOGS = process.env.DEBUG_API_LOGS === "true";
const MAX_ANALYSIS_IMAGE_BYTES = 8 * 1024 * 1024;

function debugLog(...args: unknown[]) {
  if (DEBUG_API_LOGS) console.info(...args);
}

async function requireMigrationAccess(req: NextRequest) {
  const migrationToken = req.headers.get("x-migration-token")?.trim();
  const validToken = process.env.MIGRATION_TOKEN?.trim();

  if (migrationToken && validToken && migrationToken === validToken) {
    debugLog("Migration token authentication succeeded");
    return null;
  }

  const permCheck = await checkGalleryEditPermission();
  return permCheck.authorized ? null : permCheck.error!;
}

function normalizeMigrationLimit(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return 5;
  return Math.min(Math.floor(numeric), 10);
}

function isAllowedGalleryImageUrl(imageUrl: string) {
  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("/v1", "");
  if (!storageUrl) return false;
  return imageUrl.startsWith(`${storageUrl}/storage/v1/object/public/gallery/`);
}

function normalizeAiText(value: unknown, fallback = "", max = 1500) {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

function buildEmbeddingText(category: string, data: ImageAnalysisData) {
  const detail = normalizeAiText(data.visual_detail || data.summary, "이미지 분석 결과");
  return `[${category}] ${detail}`;
}

async function parseJsonObject(req: NextRequest) {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * URL에서 이미지를 fetch하여 base64로 변환
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  try {
    if (!isAllowedGalleryImageUrl(imageUrl)) {
      throw new Error("Only gallery storage URLs are allowed");
    }

    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      throw new Error("Gallery migration target must be an image");
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_ANALYSIS_IMAGE_BYTES) {
      throw new Error("Image is too large to analyze");
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_ANALYSIS_IMAGE_BYTES) {
      throw new Error("Image is too large to analyze");
    }

    const base64 = Buffer.from(buffer).toString("base64");

    return { data: base64, mimeType: contentType };
  } catch (error) {
    console.error("❌ 이미지 fetch 실패:", error);
    throw error;
  }
}

/**
 * Gemini로 이미지 분석
 */
async function analyzeImage(imageUrl: string, title: string): Promise<{
  description: string;
  tags: string[];
  embedding: number[];
}> {
  try {
    if (!apiKey) {
      throw new Error("API Key not found");
    }

    const { data, mimeType } = await fetchImageAsBase64(imageUrl);

    // Vision 분석
      const visionModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 1200,
      },
    });

    const analysisPrompt = `Analyze this image and return ONLY valid JSON.
Title context: "${title || ""}"

{
  "category": "portrait|product|landscape|food|architecture|art|fashion|interior|animal|other",
  "summary": "Natural Korean description (2-3 sentences)",
  "visual_detail": "Objective factual detail: Main subject, colors, materials, lighting, composition, background",
  "tags": ["6-10 Korean keywords without #"]
}

Rules:
- category: Choose exactly one value from the allowed list.
- summary: Natural Korean description for UI display.
- visual_detail: Objective factual description WITHOUT emotions. Include specific colors, shapes, objects, materials, and layout.
- tags: Korean keywords only when possible, 6-10 items, no # symbols.`;

    const visionResult = await visionModel.generateContent([
      analysisPrompt,
      {
        inlineData: {
          data: data,
          mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        },
      },
    ]);

    const jsonText = visionResult.response.text();
    let parsedData: ImageAnalysisData = { summary: "", visual_detail: "", tags: [] };

    try {
      parsedData = JSON.parse(jsonText);
    } catch (e) {
      console.error("JSON Parse Error:", e);
      parsedData = { summary: "이미지 분석 실패", visual_detail: "", tags: [] };
    }

    const allowedCategories = new Set([
      "portrait",
      "product",
      "landscape",
      "food",
      "architecture",
      "art",
      "fashion",
      "interior",
      "animal",
      "other",
    ]);
    const rawCategory = typeof parsedData.category === "string" ? parsedData.category : "other";
    const imageCategory = allowedCategories.has(rawCategory) ? rawCategory : "other";

    // 태그 배열 정리
    const tagsArray = Array.isArray(parsedData.tags)
      ? parsedData.tags
          .map((tag) => normalizeAiText(tag, "", 40))
          .filter(Boolean)
          .slice(0, 15)
      : [];

    const embedding = await generateGeminiTextEmbedding(
      apiKey,
      buildEmbeddingText(imageCategory, parsedData)
    );

    return {
      description: normalizeAiText(parsedData.summary, "이미지 분석 실패"),
      tags: tagsArray,
      embedding,
    };
  } catch (error) {
    console.error("❌ 이미지 분석 실패:", error);
    throw error;
  }
}

/**
 * POST /api/gallery/migrate
 * 기존 이미지들 일괄 분석 및 임베딩 생성
 * 권한: admin, sub-admin, editor만
 * 
 * 요청:
 * {
 *   "limit": 5  // 한 번에 처리할 개수 (기본값: 5)
 * }
 * 
 * 응답:
 * {
 *   "success": true,
 *   "processed": 5,
 *   "totalRemaining": 39,
 *   "items": [...]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 권한 검증 (스크립트 토큰 또는 일반 사용자 권한)
    const authError = await requireMigrationAccess(req);
    if (authError) return authError;

    // 2. API 키 확인
    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key not found" },
        { status: 500 }
      );
    }

    // 3. 요청 데이터
    const body = await parseJsonObject(req);
    const limit = normalizeMigrationLimit(body.limit);

    const adminClient = createAdminClient();

    // 4. embedding이 NULL인 이미지들 조회
    const { data: galleryItems, error: queryError } = await adminClient
      .from("gallery")
      .select("id, title, image_url, description")
      .is("embedding", null)
      .limit(limit);

    if (queryError) {
      throw queryError;
    }

    if (!galleryItems || galleryItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: "분석할 이미지가 없습니다.",
        processed: 0,
        totalRemaining: 0,
      });
    }

    const processedItems = [];
    const failedItems = [];

    // 5. 각 이미지 분석 및 저장
    for (const item of galleryItems) {
      try {
        const analysisResult = await analyzeImage(item.image_url, item.title);

        // DB 업데이트
        const { error: updateError } = await adminClient
          .from("gallery")
          .update({
            embedding: analysisResult.embedding,
            gemini_description: analysisResult.description,
            gemini_tags: analysisResult.tags,
          })
          .eq("id", item.id);

        if (updateError) {
          throw updateError;
        }

        processedItems.push({
          id: item.id,
          title: item.title,
          status: "success",
        });
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error(`❌ 실패: [${item.id}] ${message}`);
        failedItems.push({
          id: item.id,
          title: item.title,
          status: "failed",
          error: message,
        });
      }
    }

    // 6. 남은 이미지 개수 조회
    const { count: remainingCount, error: remainingError } = await adminClient
      .from("gallery")
      .select("id", { count: "exact", head: true })
      .is("embedding", null);

    if (remainingError) {
      throw remainingError;
    }

    if (processedItems.length > 0) {
      revalidateTag(CACHE_TAGS.gallery, "max");
      revalidateTag(CACHE_TAGS.home, "max");
    }

    return NextResponse.json({
      success: true,
      processed: processedItems.length,
      failed: failedItems.length,
      totalRemaining: remainingCount || 0,
      processedItems,
      failedItems,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ 마이그레이션 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gallery/migrate
 * 마이그레이션 상태 확인
 */
export async function GET(req: NextRequest) {
  try {
    const authError = await requireMigrationAccess(req);
    if (authError) return authError;

    const supabase = createAdminClient();

    // embedding이 NULL인 이미지 개수
    const { count: nullCount, error: nullCountError } = await supabase
      .from("gallery")
      .select("id", { count: "exact", head: true })
      .is("embedding", null);

    if (nullCountError) {
      throw nullCountError;
    }

    // 전체 이미지 개수
    const { count: totalCount, error: totalCountError } = await supabase
      .from("gallery")
      .select("id", { count: "exact", head: true });

    if (totalCountError) {
      throw totalCountError;
    }

    const processedCount = (totalCount || 0) - (nullCount || 0);

    return NextResponse.json({
      success: true,
      status: {
        total: totalCount || 0,
        processed: processedCount,
        remaining: nullCount || 0,
        percentage: totalCount ? Math.round((processedCount / totalCount) * 100) : 0,
      },
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ 상태 조회 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
