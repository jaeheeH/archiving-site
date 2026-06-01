import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkGalleryEditPermission } from "@/lib/supabase/gallery-utils";
import { getErrorMessage } from "@/lib/error-message";
import { generateGeminiTextEmbedding } from "@/lib/gemini-embedding";

type ImageAnalysisData = {
  category?: unknown;
  summary?: string;
  visual_detail?: string;
  tags?: unknown;
};

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");
const MAX_ANALYSIS_IMAGE_BYTES = 8 * 1024 * 1024;

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

function normalizeAiText(value: unknown, fallback = "", max = 1500) {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

function buildEmbeddingText(category: string, data: ImageAnalysisData) {
  const detail = normalizeAiText(data.visual_detail || data.summary, "이미지 분석 결과");
  return `[${category}] ${detail}`;
}

export async function POST(req: NextRequest) {
  try {
    // 1. 권한 검증
    const permCheck = await checkGalleryEditPermission();
    if (!permCheck.authorized) return permCheck.error!;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key not found" },
        { status: 500 }
      );
    }

    // 2. 요청 데이터 가져오기
    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
    }

    const imageUrl = body.imageUrl;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace("/v1", "");
    const allowedPrefix = `${storageUrl}/storage/v1/object/public/gallery/`;

    if (typeof imageUrl !== "string" || !imageUrl.startsWith(allowedPrefix)) {
      return NextResponse.json(
        { error: "Gallery storage image URL is required" },
        { status: 400 }
      );
    }

    // 3. 이미지 fetch → base64 변환
    const imageResp = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!imageResp.ok) throw new Error(`Failed to fetch image: ${imageResp.statusText}`);
    const contentType = imageResp.headers.get("content-type") || "image/jpeg";

    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Gallery analysis target must be an image" },
        { status: 400 }
      );
    }

    const contentLength = Number(imageResp.headers.get("content-length") || 0);
    if (contentLength > MAX_ANALYSIS_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image is too large to analyze" },
        { status: 400 }
      );
    }

    const arrayBuffer = await imageResp.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_ANALYSIS_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image is too large to analyze" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");
    const mimeType = contentType;

    // 4. Vision 분석 모델 준비
    const visionModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 1200,
      },
    });

    // 5. 이미지 카테고리와 상세 분석을 한 번의 호출로 처리해 API 비용을 줄인다.
    const analysisPrompt = `Analyze this image and return ONLY valid JSON.

{
  "category": "portrait|product|landscape|food|architecture|art|fashion|interior|animal|other",
  "summary": "Natural description in Korean (2-3 sentences)",
  "visual_detail": "Objective factual detail: Main subject, colors, materials, lighting, composition, background",
  "tags": ["6-10 Korean keywords without #"]
}

Rules:
- category: Choose exactly one value from the allowed list.
- summary: Natural Korean description for UI display.
- visual_detail: Objective factual description WITHOUT emotions. Include specific colors, shapes, objects, materials, and layout.
- tags: Korean keywords only when possible, 6-10 items, no # symbols.`;

    const analysisResult = await visionModel.generateContent([
      analysisPrompt,
      { inlineData: { data: base64Image, mimeType } },
    ]);

    const jsonText = analysisResult.response?.text() ?? "{}";

    let parsedData: ImageAnalysisData = {};
    try {
      parsedData = JSON.parse(jsonText);
    } catch (e) {
      console.error("❌ JSON Parse Error:", e);
      return NextResponse.json(
        { error: "Failed to parse AI JSON response", raw: jsonText },
        { status: 500 }
      );
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

    // 6. Gemini Embedding API는 텍스트 Content를 기준으로 동작하므로,
    // 이미지 분석 결과의 객관적 묘사를 임베딩 입력으로 사용한다.
    const embedding = await generateGeminiTextEmbedding(
      apiKey,
      buildEmbeddingText(imageCategory, parsedData)
    );

    // 8. 태그 배열 정리
    const tagsArray = Array.isArray(parsedData.tags)
      ? parsedData.tags
          .map((tag) => normalizeAiText(tag, "", 40))
          .filter(Boolean)
          .slice(0, 15)
      : [];

    // 9. 최종 응답
    return NextResponse.json({
      success: true,
      category: imageCategory,
      summary: normalizeAiText(parsedData.summary, "이미지 분석 완료"),
      tags: tagsArray,
      embedding,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error, "Server Error");
    console.error("❌ AI Processing Error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
