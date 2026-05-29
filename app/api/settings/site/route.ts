import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateTag } from "next/cache";
import {
  CACHE_TAGS,
  PUBLIC_API_CACHE_CONTROL,
} from "@/lib/public-data";
import { getSiteSettings } from "@/lib/site-settings";

/**
 * GET /api/settings/site
 * 사이트 설정 조회
 * 권한: 모두 가능
 */
export async function GET() {
  try {
    const data = await getSiteSettings();

    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        headers: {
          "Cache-Control": PUBLIC_API_CACHE_CONTROL,
        },
      }
    );
  } catch (error: any) {
    console.error("❌ Site settings 조회 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/site
 * 사이트 설정 업데이트
 * 권한: admin, sub-admin만
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. 권한 확인
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: userData } = await adminClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    // admin만 가능하게 변경
    if (!userData || userData.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. 요청 데이터 파싱
    const body = await req.json();

    // 3. 기존 설정 확인
    const { data: existingSettings } = await adminClient
      .from("site_settings")
      .select("id")
      .single();

    if (existingSettings) {
      // 업데이트
      const { data, error } = await adminClient
        .from("site_settings")
        .update({
          ...body,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSettings.id)
        .select()
        .single();

      if (error) throw error;

      revalidateTag(CACHE_TAGS.siteSettings, "max");

      return NextResponse.json({
        success: true,
        data,
      });
    } else {
      // 새로 삽입
      const { data, error } = await adminClient
        .from("site_settings")
        .insert({
          ...body,
          updated_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      revalidateTag(CACHE_TAGS.siteSettings, "max");

      return NextResponse.json({
        success: true,
        data,
      });
    }
  } catch (error: any) {
    console.error("❌ Site settings 저장 에러:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
