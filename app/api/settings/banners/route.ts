import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { CACHE_TAGS } from "@/lib/public-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BANNER_COLUMNS =
  "id, title, subtitle, label, image_url, link, is_continuous, start_date, end_date, order_index, is_active";

async function requireDashboardManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "sub-admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { admin, user };
}

function sanitizeBanner(body: Record<string, unknown>) {
  return {
    title: typeof body.title === "string" ? body.title.trim() : "",
    subtitle: typeof body.subtitle === "string" && body.subtitle.trim() ? body.subtitle.trim() : null,
    label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : null,
    image_url: typeof body.image_url === "string" ? body.image_url.trim() : "",
    link: typeof body.link === "string" && body.link.trim() ? body.link.trim() : null,
    is_continuous: Boolean(body.is_continuous),
    start_date: typeof body.start_date === "string" && body.start_date ? body.start_date : null,
    end_date: typeof body.end_date === "string" && body.end_date ? body.end_date : null,
    order_index: Number.isFinite(Number(body.order_index)) ? Number(body.order_index) : 0,
    is_active: body.is_active !== false,
  };
}

export async function GET() {
  const auth = await requireDashboardManager();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.admin
    .from("banners")
    .select(BANNER_COLUMNS)
    .order("order_index", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: data || [] }, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireDashboardManager();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const payload = sanitizeBanner(body);

  if (!payload.title || !payload.image_url) {
    return NextResponse.json({ error: "제목과 이미지는 필수입니다." }, { status: 400 });
  }

  const { data, error } = await auth.admin
    .from("banners")
    .insert(payload)
    .select(BANNER_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidateTag(CACHE_TAGS.home, "max");
  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireDashboardManager();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const id = typeof body.id === "string" ? body.id : "";
  const payload = sanitizeBanner(body);

  if (!id) {
    return NextResponse.json({ error: "배너 ID가 필요합니다." }, { status: 400 });
  }

  if (!payload.title || !payload.image_url) {
    return NextResponse.json({ error: "제목과 이미지는 필수입니다." }, { status: 400 });
  }

  const { data, error } = await auth.admin
    .from("banners")
    .update(payload)
    .eq("id", id)
    .select(BANNER_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidateTag(CACHE_TAGS.home, "max");
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireDashboardManager();
  if ("error" in auth) return auth.error;

  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "배너 ID가 필요합니다." }, { status: 400 });
  }

  const { error } = await auth.admin.from("banners").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidateTag(CACHE_TAGS.home, "max");
  return NextResponse.json({ success: true });
}
