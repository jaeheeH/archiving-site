import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * 두 벡터 간의 코사인 유사도 계산
 */
function calculateCosineSimilarity(vector1: number[], vector2: number[]): number {
  if (vector1.length !== vector2.length) {
    // 벡터 길이가 다르면 유사도 계산 불가 (보통 0 처리하거나 에러)
    return 0;
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

export async function POST(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const galleryId = parseInt(id);

    // 디버깅: ID 확인
    console.log(`🔍 유사 이미지 검색 요청 - ID: ${galleryId}`);

    if (isNaN(galleryId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Body 파싱 안전하게 처리 (Body가 없어도 죽지 않게 함)
    let limit = 10;
    try {
      const text = await req.text(); // 먼저 텍스트로 읽음
      if (text) {
        const body = JSON.parse(text);
        if (body.limit) limit = body.limit;
      }
    } catch (e) {
      console.warn("⚠️ Request body parsing warning (using defaults):", e);
    }

    const similarityThreshold = 0.75; 

    // 2. 현재 이미지 조회
    const { data: currentGallery, error: currentError } = await supabase
      .from("gallery")
      .select("embedding, title")
      .eq("id", galleryId)
      .single();

    if (currentError) {
      console.error('❌ Supabase DB Error (Target Image):', currentError);
      // RLS 에러인 경우 힌트 제공
      if (currentError.code === 'PGRST116') {
        console.error('👉 데이터가 없거나, RLS 정책 때문에 접근 권한이 없습니다.');
      }
      return NextResponse.json(
        { error: "Gallery not found", details: currentError.message },
        { status: 404 }
      );
    }

    if (!currentGallery) {
      console.error('❌ Data is null for ID:', galleryId);
      return NextResponse.json(
        { error: "Gallery not found (Data is null)" },
        { status: 404 }
      );
    }

    if (!currentGallery.embedding) {
      return NextResponse.json(
        { error: "No embedding found. Please re-analyze the image." },
        { status: 400 }
      );
    }

    // Embedding 파싱
    let currentEmbedding: number[];
    if (typeof currentGallery.embedding === "string") {
      currentEmbedding = JSON.parse(currentGallery.embedding);
    } else if (Array.isArray(currentGallery.embedding)) {
      currentEmbedding = currentGallery.embedding;
    } else {
      throw new Error("Invalid embedding format");
    }

    // 3. 비교군 이미지 조회
    const { data: allGalleries, error: allError } = await supabase
      .from("gallery")
      .select("id, title, image_url, image_width, image_height, description, embedding")
      .neq("id", galleryId)
      .not("embedding", "is", null);

    if (allError) {
      console.error('❌ Supabase DB Error (Comparison Images):', allError);
      throw allError;
    }

    if (!allGalleries || allGalleries.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 4. 유사도 계산
    const similarities = allGalleries
      .map((gallery) => {
        let embedding: number[];
        
        try {
            if (typeof gallery.embedding === "string") {
            embedding = JSON.parse(gallery.embedding);
            } else if (Array.isArray(gallery.embedding)) {
            embedding = gallery.embedding;
            } else {
            return null;
            }
        } catch (e) {
            return null;
        }

        const similarity = calculateCosineSimilarity(currentEmbedding, embedding);

        return {
          id: gallery.id,
          title: gallery.title,
          image_url: gallery.image_url,
          image_width: gallery.image_width,
          image_height: gallery.image_height,
          description: gallery.description,
          similarity,
        };
      })
      .filter((item) => item !== null && item.similarity >= similarityThreshold)
      .sort((a, b) => (b?.similarity ?? 0) - (a?.similarity ?? 0))
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: similarities,
      metadata: {
        totalSimilar: similarities.length,
        threshold: similarityThreshold,
      },
    });

  } catch (error: any) {
    console.error("❌ 유사 이미지 검색 최종 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}