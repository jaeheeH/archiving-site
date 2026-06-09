import { NextRequest, NextResponse } from "next/server";

import { getGeneratedImageLibrary } from "@/lib/dashboard-data";
import { getErrorMessage } from "@/lib/error-message";

function parsePositiveInt(value: string | null, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return fallback;
  return Math.floor(numeric);
}

function parseOffset(value: string | null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getGeneratedImageLibrary({
      limit: parsePositiveInt(searchParams.get("limit"), 40),
      offset: parseOffset(searchParams.get("offset")),
      brand: searchParams.get("brand") || "",
      search: searchParams.get("search") || "",
    });

    if (!data) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
