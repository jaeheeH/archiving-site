import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkGalleryEditPermission } from "@/lib/supabase/gallery-utils";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(req: NextRequest) {
  try {
    // 1. 권한 검증
    const permCheck = await checkGalleryEditPermission();
    if (!permCheck.authorized) return permCheck.error;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key not found" },
        { status: 500 }
      );
    }

    // 2. 요청 데이터 가져오기
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    // 3. 이미지 fetch → base64 변환
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) throw new Error(`Failed to fetch image: ${imageResp.statusText}`);

    const arrayBuffer = await imageResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");
    const mimeType = imageResp.headers.get("content-type") || "image/jpeg";

    // 4. Vision 분석 모델 준비
    const visionModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    // 5. 1단계: 이미지 카테고리 분류
    const categoryPrompt = `Classify this image into ONE category. Return ONLY valid JSON.

{
  "category": "portrait|product|landscape|food|architecture|art|fashion|interior|animal|other"
}

Choose the most appropriate category. Return ONLY the JSON object.`;

    const categoryResult = await visionModel.generateContent([
      categoryPrompt,
      { inlineData: { data: base64Image, mimeType } },
    ]);

    let imageCategory = "other";
    try {
      const categoryData = JSON.parse(categoryResult.response?.text() ?? "{}");
      imageCategory = categoryData.category || "other";
    } catch (e) {
      console.error("카테고리 분류 실패, 기본값 사용");
    }

    // 6. 2단계: 카테고리별 맞춤 분석
    const categoryPrompts: Record<string, string> = {
      portrait: `Analyze this portrait/person image. Return ONLY valid JSON.

{
  "summary": "Natural description in Korean (2-3 sentences)",
  "visual_detail": "Subject: Gender/Age | Clothing: Specific color (e.g., 'Black V-neck dress', 'White ribbed t-shirt'), Style | Hair: Color, Style | Background: Color, Objects | Pose: Description | Expression: Description",
  "tags": ["인물사진", "표정", "의상스타일", "조명", "분위기", etc.]
}

Rules:
- summary: Natural Korean description for UI display
- visual_detail: Objective factual description WITHOUT emotions, focusing on colors, shapes, objects
- tags: 6-10 Korean keywords (WITHOUT #)`,

      product: `Analyze this product image. Return ONLY valid JSON.

{
  "summary": "Natural description in Korean (2-3 sentences)",
  "visual_detail": "Product: Type | Color: Main color (specific name), Accent colors | Material: Texture description | Shape: Geometric form | Background: Color, Setting",
  "tags": ["제품사진", "제품타입", "색상", "디자인스타일", "배경", etc.]
}

Rules:
- summary: Natural Korean description for UI display
- visual_detail: Objective factual description WITHOUT emotions, focusing on colors, materials, shapes
- tags: 6-10 Korean keywords (WITHOUT #)`,

      landscape: `Analyze this landscape/nature image. Return ONLY valid JSON.

{
  "summary": "Natural description in Korean (2-3 sentences)",
  "visual_detail": "Location: Type (mountain/sea/city/forest) | Colors: Dominant colors (specific names) | Time: Time of day indicators | Weather: Sky condition | Composition: Main elements positions",
  "tags": ["풍경사진", "장소타입", "시간대", "날씨", "색감", etc.]
}

Rules:
- summary: Natural Korean description for UI display
- visual_detail: Objective factual description WITHOUT emotions, focusing on location, colors, weather
- tags: 6-10 Korean keywords (WITHOUT #)`,

      food: `Analyze this food image. Return ONLY valid JSON.

{
  "summary": "Natural description in Korean (2-3 sentences)",
  "visual_detail": "Food: Type, Cuisine | Colors: Main colors of food | Plating: Dish type, Arrangement | Background: Surface color, Props | Lighting: Direction, Quality",
  "tags": ["음식사진", "요리타입", "플레이팅", "색감", "조명", etc.]
}

Rules:
- summary: Natural Korean description for UI display
- visual_detail: Objective factual description WITHOUT emotions, focusing on food type, colors, plating
- tags: 6-10 Korean keywords (WITHOUT #)`,

      other: `Analyze this image. Return ONLY valid JSON.

{
  "summary": "Natural description in Korean (2-3 sentences)",
  "visual_detail": "Main Object: Type | Colors: Dominant colors (specific names) | Lighting: Direction, Quality | Composition: Element positions | Background: Description",
  "tags": ["keyword1", "keyword2", "keyword3", etc.]
}

Rules:
- summary: Natural Korean description for UI display
- visual_detail: Objective factual description WITHOUT emotions, focusing on objects, colors, composition
- tags: 6-10 Korean keywords (WITHOUT #)`
    };

    const detailedPrompt = categoryPrompts[imageCategory] || categoryPrompts.other;

    const detailedResult = await visionModel.generateContent([
      detailedPrompt,
      { inlineData: { data: base64Image, mimeType } },
    ]);

    const jsonText = detailedResult.response?.text() ?? "{}";

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(jsonText);
    } catch (e) {
      console.error("❌ JSON Parse Error:", e);
      return NextResponse.json(
        { error: "Failed to parse AI JSON response", raw: jsonText },
        { status: 500 }
      );
    }

    // 7. 하이브리드 임베딩 생성
    // 이미지 크기에 따라 멀티모달 또는 텍스트 임베딩 사용
    let embedding: number[];

    // base64 이미지 크기 체크 (36KB = 약 48000 chars in base64)
    const imageSizeKB = (base64Image.length * 3) / 4 / 1024;

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
                  data: base64Image,
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

    // 8. 태그 배열 정리
    const tagsArray = Array.isArray(parsedData.tags)
      ? parsedData.tags.slice(0, 15)
      : [];

    // 9. 최종 응답
    return NextResponse.json({
      success: true,
      category: imageCategory,
      summary: parsedData.summary || "이미지 분석 완료",
      tags: tagsArray,
      embedding,
    });
  } catch (error: any) {
    console.error("❌ AI Processing Error:", error);
    return NextResponse.json(
      { error: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
