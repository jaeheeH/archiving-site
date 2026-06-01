import { NextRequest, NextResponse } from "next/server";
import {
  PUBLIC_API_CACHE_CONTROL,
  getSimilarGallery,
} from "@/lib/public-data";
import { getErrorMessage } from "@/lib/error-message";
import { parsePositiveIntParam } from "@/lib/route-params";

interface Props {
  params: Promise<{ id: string }>;
}

function parseLimit(req: NextRequest) {
  const urlLimit = Number(req.nextUrl.searchParams.get("limit"));
  return Number.isFinite(urlLimit) && urlLimit > 0 ? urlLimit : 8;
}

async function handleSimilar(req: NextRequest, { params }: Props) {
  const { id } = await params;
  const galleryId = parsePositiveIntParam(id);

  if (!galleryId) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  try {
    const limit = parseLimit(req);
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
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("유사 이미지 검색 에러:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, props: Props) {
  return handleSimilar(req, props);
}
