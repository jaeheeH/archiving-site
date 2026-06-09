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

function isMissingViewCountSchema(error: QueryError) {
  const message = error?.message || "";

  return (
    /view_count/i.test(message) &&
    (error?.code === "42703" || error?.code === "PGRST204")
  );
}

function isMissingViewLogSchema(error: QueryError) {
  const message = error?.message || "";

  return (
    error?.code === "42P01" ||
    (/(gallery_views|gallery_id|user_id|visitor_hash)/i.test(message) &&
      (error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST205"))
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

  if (isMissingViewCountSchema(result.error)) {
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

async function incrementGalleryViewCount(
  admin: ReturnType<typeof createAdminClient>,
  galleryId: number,
  currentViewCount: number | null
) {
  const nextViewCount = (currentViewCount || 0) + 1;
  const { data: updatedGallery, error: updateError } = await admin
    .from("gallery")
    .update({ view_count: nextViewCount })
    .eq("id", galleryId)
    .select("view_count")
    .single();

  if (updateError) throw updateError;

  return updatedGallery?.view_count || nextViewCount;
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

    let viewLogUnavailable = false;

    if (user) {
      const { data: recentView, error: recentViewError } = await admin
        .from("gallery_views")
        .select("id")
        .eq("gallery_id", galleryId)
        .eq("user_id", user.id)
        .gte("created_at", oneDayAgo)
        .maybeSingle();

      if (isMissingViewLogSchema(recentViewError)) {
        viewLogUnavailable = true;
      } else if (recentViewError) {
        throw recentViewError;
      }

      if (recentView) {
        return jsonNoStore({
          message: "오늘 이미 조회한 이미지입니다",
          viewCount: currentGallery.view_count || 0,
          incremented: false,
          isLoggedIn: true,
        });
      }

      if (!viewLogUnavailable) {
        const { error: insertError } = await admin.from("gallery_views").insert({
          gallery_id: galleryId,
          user_id: user.id,
          visitor_hash: null,
        });

        if (isMissingViewLogSchema(insertError)) {
          viewLogUnavailable = true;
        } else if (insertError) {
          throw insertError;
        }
      }
    } else {
      const visitorHash = getVisitorHash(request, galleryId);
      const { data: recentView, error: recentViewError } = await admin
        .from("gallery_views")
        .select("id")
        .eq("gallery_id", galleryId)
        .eq("visitor_hash", visitorHash)
        .gte("created_at", oneDayAgo)
        .maybeSingle();

      if (isMissingViewLogSchema(recentViewError)) {
        viewLogUnavailable = true;
      } else if (recentViewError) {
        throw recentViewError;
      }

      if (recentView) {
        return jsonNoStore({
          message: "오늘 이미 조회한 이미지입니다",
          viewCount: currentGallery.view_count || 0,
          incremented: false,
          isLoggedIn: false,
        });
      }

      if (!viewLogUnavailable) {
        const { error: insertError } = await admin.from("gallery_views").insert({
          gallery_id: galleryId,
          user_id: null,
          visitor_hash: visitorHash,
        });

        if (isMissingViewLogSchema(insertError)) {
          viewLogUnavailable = true;
        } else if (insertError) {
          throw insertError;
        }
      }
    }

    const viewCount = await incrementGalleryViewCount(
      admin,
      galleryId,
      currentGallery.view_count
    );

    return jsonNoStore({
      message: "조회수가 증가했습니다",
      viewCount,
      incremented: true,
      isLoggedIn: Boolean(user),
      viewLogUnavailable,
    });
  } catch (error) {
    console.error("Gallery view count API error:", error);
    return jsonNoStore({ error: "서버 오류" }, 500);
  }
}
