import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// API 키 환경변수 확인
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json({ error: "API Key not found" }, { status: 500 });
    }

    const { imageUrl, title } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }

    // 1. URL에서 이미지 가져오기
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) {
        throw new Error(`Failed to fetch image: ${imageResp.statusText}`);
    }
    const arrayBuffer = await imageResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");
    const mimeType = imageResp.headers.get("content-type") || "image/jpeg";

    // 2. Gemini 1.5 Flash로 이미지 분석
    const visionModel = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" } 
    });

    // ✨ 프롬프트 최적화: 시각적 유사성을 위해 '스타일', '색감', '구도' 묘사를 강조
    const prompt = `
      Analyze this image for a 'Visual Similarity Search' engine. 
      Context title: "${title}".
      
      Return a JSON object with:
      1. "description": A highly detailed visual description in Korean. 
         - Must describe: Art style (e.g., oil painting, vector, photo), Lighting, Color palette, Composition, and Main objects.
         - This text will be used to generate a vector embedding to find visually similar images.
      2. "tags": An array of 5-8 keywords in Korean (e.g., #Minimalist, #Blue, #Nature).
      
      JSON Schema:
      {
        "description": "string",
        "tags": ["string", "string"]
      }
    `;

    const visionResult = await visionModel.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ]);

    const jsonText = visionResult.response.text();
    let parsedData = { description: "", tags: [] };
    
    try {
        parsedData = JSON.parse(jsonText);
    } catch (e) {
        console.error("JSON Parse Error:", e);
        parsedData = { description: "이미지 분석 실패", tags: [] };
    }

    // 3. 텍스트 임베딩 생성 (text-embedding-004)
    // 최적화된 '시각적 묘사'를 벡터로 변환하므로 이미지 검색 품질이 높아집니다.
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    // 제목과 묘사를 합쳐서 임베딩하면 더 정확합니다.
    const textToEmbed = `Title: ${title}\nDescription: ${parsedData.description}`;
    const embeddingResult = await embeddingModel.embedContent(textToEmbed);
    
    const embedding = embeddingResult.embedding.values; // vector(768)

    // 4. 결과 반환
    return NextResponse.json({
      success: true,
      gemini_description: parsedData.description,
      gemini_tags: parsedData.tags,
      embedding: embedding
    });

  } catch (error: any) {
    console.error("❌ AI Processing Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}