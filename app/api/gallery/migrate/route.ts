import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkGalleryEditPermission } from "@/lib/supabase/gallery-utils";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

/**
 * URL에서 이미지를 fetch하여 base64로 변환
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";

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
    const { data, mimeType } = await fetchImageAsBase64(imageUrl);

    // Vision 분석
    const visionModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    // 1단계: 카테고리 분류
    const categoryPrompt = `Classify this image into ONE category. Return ONLY valid JSON.

{
  "category": "portrait|product|landscape|food|architecture|art|fashion|interior|animal|other"
}

Choose the most appropriate category. Return ONLY the JSON object.`;

    const categoryResult = await visionModel.generateContent([
      categoryPrompt,
      {
        inlineData: {
          data: data,
          mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        },
      },
    ]);

    let imageCategory = "other";
    try {
      const categoryData = JSON.parse(categoryResult.response?.text() ?? "{}");
      imageCategory = categoryData.category || "other";
    } catch (e) {
      console.error("카테고리 분류 실패, 기본값 사용");
    }

    // 2단계: 카테고리별 맞춤 분석
    const categoryPrompts: Record<string, string> = {
      portrait: `Analyze this portrait/person image. Return ONLY valid JSON.
{"summary": "Natural Korean description (2-3 sentences)", "visual_detail": "Subject: Gender/Age | Clothing: Specific color, Style | Hair: Color, Style | Background: Color, Objects | Pose: Description | Expression: Description", "tags": ["인물사진", "표정", etc.]}
Rules: visual_detail = objective facts WITHOUT emotions, focusing on colors/shapes/objects`,

      product: `Analyze this product image. Return ONLY valid JSON.
{"summary": "Natural Korean description (2-3 sentences)", "visual_detail": "Product: Type | Color: Main color (specific), Accents | Material: Texture | Shape: Form | Background: Color, Setting", "tags": ["제품사진", "제품타입", etc.]}
Rules: visual_detail = objective facts WITHOUT emotions, focusing on colors/materials/shapes`,

      landscape: `Analyze this landscape/nature image. Return ONLY valid JSON.
{"summary": "Natural Korean description (2-3 sentences)", "visual_detail": "Location: Type | Colors: Dominant colors (specific) | Time: Indicators | Weather: Sky | Composition: Elements", "tags": ["풍경사진", "장소타입", etc.]}
Rules: visual_detail = objective facts WITHOUT emotions, focusing on location/colors/weather`,

      food: `Analyze this food image. Return ONLY valid JSON.
{"summary": "Natural Korean description (2-3 sentences)", "visual_detail": "Food: Type, Cuisine | Colors: Main colors | Plating: Dish, Arrangement | Background: Surface, Props | Lighting: Direction", "tags": ["음식사진", "요리타입", etc.]}
Rules: visual_detail = objective facts WITHOUT emotions, focusing on food/colors/plating`,

      other: `Analyze this image. Return ONLY valid JSON.
{"summary": "Natural Korean description (2-3 sentences)", "visual_detail": "Main Object: Type | Colors: Dominant colors (specific) | Lighting: Direction | Composition: Positions | Background: Description", "tags": ["keyword1", "keyword2", etc.]}
Rules: visual_detail = objective facts WITHOUT emotions, focusing on objects/colors/composition`
    };

    const detailedPrompt = categoryPrompts[imageCategory] || categoryPrompts.other;

    const visionResult = await visionModel.generateContent([
      detailedPrompt,
      {
        inlineData: {
          data: data,
          mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        },
      },
    ]);

    const jsonText = visionResult.response.text();
    let parsedData: any = { summary: "", visual_detail: "", tags: [] };

    try {
      parsedData = JSON.parse(jsonText);
    } catch (e) {
      console.error("JSON Parse Error:", e);
      parsedData = { summary: "이미지 분석 실패", visual_detail: "", tags: [] };
    }

    // 태그 배열 정리
    const tagsArray = Array.isArray(parsedData.tags)
      ? parsedData.tags.slice(0, 15)
      : [];

    // 하이브리드 임베딩 생성
    // 이미지 크기에 따라 멀티모달 또는 텍스트 임베딩 사용
    let embedding: number[];

    // base64 이미지 크기 체크 (36KB = 약 48000 chars in base64)
    const imageSizeKB = (data.length * 3) / 4 / 1024;

    if (imageSizeKB < 30) {
      // 작은 이미지: 멀티모달 임베딩 (더 정확)
      try {
        const multimodalModel = genAI.getGenerativeModel({
          model: "embedding-001",
        });

        const embeddingRes = await multimodalModel.embedContent({
          content: {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: data,
                  mimeType: mimeType,
                },
              },
            ],
          },
        });

        embedding = embeddingRes.embedding.values;
      } catch (error: any) {
        console.error("멀티모달 임베딩 실패, 텍스트 임베딩으로 폴백:", error.message);
        // 폴백: 텍스트 임베딩 (visual_detail 우선 사용)
        const textModel = genAI.getGenerativeModel({
          model: "text-embedding-004",
        });
        const embeddingText = `[${imageCategory}] ${parsedData.visual_detail || parsedData.summary}`;
        const textEmbeddingRes = await textModel.embedContent(embeddingText);
        embedding = textEmbeddingRes.embedding.values;
      }
    } else {
      // 큰 이미지: 카테고리+visual_detail로 텍스트 임베딩
      const textModel = genAI.getGenerativeModel({
        model: "text-embedding-004",
      });
      const embeddingText = `[${imageCategory}] ${parsedData.visual_detail || parsedData.summary}`;
      const textEmbeddingRes = await textModel.embedContent(embeddingText);
      embedding = textEmbeddingRes.embedding.values;
    }

    return {
      description: parsedData.summary,
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
    const migrationToken = req.headers.get('x-migration-token');
    const validToken = process.env.MIGRATION_TOKEN;

    if (migrationToken && validToken && migrationToken === validToken) {
      // 마이그레이션 토큰으로 인증 통과
      console.log('✅ 마이그레이션 토큰 인증 성공');
    } else {
      // 일반 사용자 권한 검증
      const permCheck = await checkGalleryEditPermission();
      if (!permCheck.authorized) {
        return permCheck.error!;
      }
    }

    // 2. API 키 확인
    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key not found" },
        { status: 500 }
      );
    }

    // 3. 요청 데이터
    const body = await req.json();
    const limit = body.limit || 5;

    const supabase = await createClient();

    // 4. embedding이 NULL인 이미지들 조회
    const { data: galleryItems, error: queryError } = await supabase
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

    const adminClient = createAdminClient();
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
      } catch (error: any) {
        console.error(`❌ 실패: [${item.id}] ${error.message}`);
        failedItems.push({
          id: item.id,
          title: item.title,
          status: "failed",
          error: error.message,
        });
      }
    }

    // 6. 남은 이미지 개수 조회
    const { count: remainingCount } = await supabase
      .from("gallery")
      .select("*", { count: "exact", head: true })
      .is("embedding", null);

    return NextResponse.json({
      success: true,
      processed: processedItems.length,
      failed: failedItems.length,
      totalRemaining: remainingCount || 0,
      processedItems,
      failedItems,
    });
  } catch (error: any) {
    console.error("❌ 마이그레이션 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
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
    const supabase = await createClient();

    // embedding이 NULL인 이미지 개수
    const { count: nullCount } = await supabase
      .from("gallery")
      .select("*", { count: "exact", head: true })
      .is("embedding", null);

    // 전체 이미지 개수
    const { count: totalCount } = await supabase
      .from("gallery")
      .select("*", { count: "exact", head: true });

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
  } catch (error: any) {
    console.error("❌ 상태 조회 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}