import { NextRequest, NextResponse } from "next/server";
import {
  PUBLIC_API_CACHE_CONTROL,
  getSimilarGallery,
} from "@/lib/public-data";

interface Props {
  params: Promise<{ id: string }>;
}

async function parseLimit(req: NextRequest) {
  const urlLimit = Number(req.nextUrl.searchParams.get("limit"));
  if (Number.isFinite(urlLimit) && urlLimit > 0) return urlLimit;

  try {
    const text = await req.text();
    if (!text) return 8;

    const body = JSON.parse(text);
    return Number(body.limit) || 8;
  } catch {
    return 8;
  }
}

async function handleSimilar(req: NextRequest, { params }: Props) {
  const { id } = await params;
  const galleryId = Number(id);

  if (!Number.isFinite(galleryId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  try {
    const limit = await parseLimit(req);
    const result = await getSimilarGallery(galleryId, limit);

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      {
        headers: {
          "Cache-Control": PUBLIC_API_CACHE_CONTROL,
        },
      }
    );
  } catch (error: any) {
    console.error("유사 이미지 검색 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, props: Props) {
  return handleSimilar(req, props);
}

export async function POST(req: NextRequest, props: Props) {
  return handleSimilar(req, props);
}
