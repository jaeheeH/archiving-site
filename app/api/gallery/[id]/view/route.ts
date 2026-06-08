import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { parsePositiveIntParam } from "@/lib/route-params";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type QueryError = { code?: string; message?: string } | null;

function jsonNoStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

function getVisitorHash(request: NextRequest, galleryId: number) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const realIp = request.headers.get("x-real-ip") || "";
  const userAgent = request.headers.get("user-agent") || "";
  const source = `${galleryId}:${forwardedFor || realIp}:${userAgent}`;

  return createHash("sha256").update(source).digest("hex");
}

function isMissingViewSchema(error: QueryError) {
  return (
    error?.code === "42P01" ||
    (error?.code === "42703" && /(view_count|gallery_views)/i.test(error.message || ""))
  );
}

async function readCurrentGallery(
  admin: ReturnType<typeof createAdminClient>,
  galleryId: number
) {
  const result = await admin
    .from("gallery")
    .select("id, view_count")
    .eq("id", galleryId)
    .maybeSingle();

  if (isMissingViewSchema(result.error)) {
    const fallback = await admin
      .from("gallery")
      .select("id")
      .eq("id", galleryId)
      .maybeSingle();

    return {
      data: fallback.data ? { id: fallback.data.id, view_count: 0 } : null,
      error: fallback.error,
      migrationRequired: true,
    };
  }

  return {
    data: result.data,
    error: result.error,
    migrationRequired: false,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const galleryId = parsePositiveIntParam(id);

  if (!galleryId) {
    return jsonNoStore({ error: "Invalid gallery id" }, 400);
  }

  try {
    const admin = createAdminClient();
    const { data: currentGallery, error, migrationRequired } =
      await readCurrentGallery(admin, galleryId);

    if (error) throw error;

    if (!currentGallery) {
      return jsonNoStore({ error: "Gallery not found" }, 404);
    }

    if (migrationRequired) {
      return jsonNoStore({
        message: "Gallery view migration is required",
        viewCount: 0,
        incremented: false,
        migrationRequired: true,
      });
    }

    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    if (user) {
      const { data: recentView, error: recentViewError } = await admin
        .from("gallery_views")
        .select("id")
        .eq("gallery_id", galleryId)
        .eq("user_id", user.id)
        .gte("created_at", oneDayAgo)
        .maybeSingle();

      if (isMissingViewSchema(recentViewError)) {
        return jsonNoStore({
          message: "Gallery view migration is required",
          viewCount: currentGallery.view_count || 0,
          incremented: false,
          migrationRequired: true,
        });
      }
      if (recentViewError) throw recentViewError;

      if (recentView) {
        return jsonNoStore({
          message: "오늘 이미 조회한 이미지입니다",
          viewCount: currentGallery.view_count || 0,
          incremented: false,
          isLoggedIn: true,
        });
      }

      const { error: insertError } = await admin.from("gallery_views").insert({
        gallery_id: galleryId,
        user_id: user.id,
        visitor_hash: null,
      });

      if (insertError) throw insertError;
    } else {
      const visitorHash = getVisitorHash(request, galleryId);
      const { data: recentView, error: recentViewError } = await admin
        .from("gallery_views")
        .select("id")
        .eq("gallery_id", galleryId)
        .eq("visitor_hash", visitorHash)
        .gte("created_at", oneDayAgo)
        .maybeSingle();

      if (isMissingViewSchema(recentViewError)) {
        return jsonNoStore({
          message: "Gallery view migration is required",
          viewCount: currentGallery.view_count || 0,
          incremented: false,
          migrationRequired: true,
        });
      }
      if (recentViewError) throw recentViewError;

      if (recentView) {
        return jsonNoStore({
          message: "오늘 이미 조회한 이미지입니다",
          viewCount: currentGallery.view_count || 0,
          incremented: false,
          isLoggedIn: false,
        });
      }

      const { error: insertError } = await admin.from("gallery_views").insert({
        gallery_id: galleryId,
        user_id: null,
        visitor_hash: visitorHash,
      });

      if (insertError) throw insertError;
    }

    const nextViewCount = (currentGallery.view_count || 0) + 1;
    const { data: updatedGallery, error: updateError } = await admin
      .from("gallery")
      .update({ view_count: nextViewCount })
      .eq("id", galleryId)
      .select("view_count")
      .single();

    if (updateError) throw updateError;

    return jsonNoStore({
      message: "조회수가 증가했습니다",
      viewCount: updatedGallery?.view_count || nextViewCount,
      incremented: true,
      isLoggedIn: Boolean(user),
    });
  } catch (error) {
    console.error("Gallery view count API error:", error);
    return jsonNoStore({ error: "서버 오류" }, 500);
  }
}
