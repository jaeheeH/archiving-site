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
    throw new Error("Vectors must have the same length");
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

/**
 * POST /api/gallery/[id]/similar
 * 유사한 갤러리 이미지 찾기
 * 권한: 모두 가능
 *
 * 요청:
 * {
 *   "limit": 10  // 기본값: 10
 * }
 *
 * 응답:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "title": "...",
 *       "similarity": 0.85
 *     }
 *   ]
 * }
 */
export async function POST(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const galleryId = parseInt(id);

    const supabase = await createClient();

    // 요청 데이터 파싱
    const body = await req.json();
    const limit = body.limit || 10;
    const similarityThreshold = 0.75; // 80% 이상 유사

    // 1. 현재 이미지의 embedding 조회
    const { data: currentGallery, error: currentError } = await supabase
      .from("gallery")
      .select("embedding, title")
      .eq("id", galleryId)
      .single();

    if (currentError || !currentGallery) {
      return NextResponse.json(
        { error: "Gallery not found" },
        { status: 404 }
      );
    }

    if (!currentGallery.embedding) {
      return NextResponse.json(
        {
          error: "This gallery item does not have an embedding. Please re-analyze the image.",
        },
        { status: 400 }
      );
    }

    // embedding을 배열로 파싱 (DB에서 문자열로 저장된 경우)
    let currentEmbedding: number[];
    if (typeof currentGallery.embedding === "string") {
      currentEmbedding = JSON.parse(currentGallery.embedding);
    } else if (Array.isArray(currentGallery.embedding)) {
      currentEmbedding = currentGallery.embedding;
    } else {
      throw new Error("Invalid embedding format");
    }

    // 2. 모든 gallery 아이템의 embedding 조회 (현재 이미지 제외)
    const { data: allGalleries, error: allError } = await supabase
      .from("gallery")
      .select("id, title, image_url, image_width, image_height, description, embedding")
      .neq("id", galleryId)
      .not("embedding", "is", null);

    if (allError) {
      throw allError;
    }

    if (!allGalleries || allGalleries.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // 3. 코사인 유사도 계산
    const similarities = allGalleries
      .map((gallery) => {
        let embedding: number[];

        if (typeof gallery.embedding === "string") {
          embedding = JSON.parse(gallery.embedding);
        } else if (Array.isArray(gallery.embedding)) {
          embedding = gallery.embedding;
        } else {
          return null;
        }

        const similarity = calculateCosineSimilarity(currentEmbedding, embedding);

        return {
          id: gallery.id,
          title: gallery.title,
          image_url: gallery.image_url,
          description: gallery.description,
          similarity,
        };
      })
      .filter(
        (item) =>
          item !== null &&
          item.similarity >= similarityThreshold
      )
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
    console.error("❌ 유사 이미지 검색 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}