import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function isAllowedImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith("supabase.co");
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src");

  if (!src || !isAllowedImageUrl(src)) {
    return NextResponse.json({ error: "Invalid image source" }, { status: 400 });
  }

  const imageResponse = await fetch(src, {
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*",
    },
  });

  if (!imageResponse.ok) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const contentLength = Number(imageResponse.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 });
  }

  const sourceBuffer = Buffer.from(await imageResponse.arrayBuffer());
  if (sourceBuffer.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 });
  }

  const jpeg = await sharp(sourceBuffer)
    .rotate()
    .resize({ width: 900, withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
