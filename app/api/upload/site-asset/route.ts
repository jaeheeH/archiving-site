import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/upload/site-asset
 * 사이트 에셋 이미지 업로드 (favicon, og-image 등)
 * 권한: 인증된 사용자
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. FormData 파싱
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = formData.get("folder") as string; // 'favicon', 'og-image', 'icons' 등

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    // 3. 파일명 생성 (타임스탬프 + 원본 파일명)
    const timestamp = Date.now();
    const fileName = `${folder || "misc"}/${timestamp}-${file.name}`;

    // 4. Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from("site-assets")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // 5. Public URL 생성
    const {
      data: { publicUrl },
    } = supabase.storage.from("site-assets").getPublicUrl(data.path);

    return NextResponse.json({
      success: true,
      data: {
        path: data.path,
        url: publicUrl,
      },
    });
  } catch (error: any) {
    console.error("❌ 이미지 업로드 에러:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload/site-asset
 * 사이트 에셋 이미지 삭제
 * 권한: admin, sub-admin
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. 권한 확인
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || !["admin", "sub-admin"].includes(userData.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. 파일 경로 가져오기
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      );
    }

    // 3. 파일 삭제
    const { error } = await supabase.storage
      .from("site-assets")
      .remove([filePath]);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("❌ 이미지 삭제 에러:", error);
    return NextResponse.json(
      { error: error.message || "Delete failed" },
      { status: 500 }
    );
  }
}