import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 아카이빙 수정/삭제 권한 검증
 * 관리자(admin), 부관리자(sub_admin)만 가능
 */
export async function checkArchivingEditPermission() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        ),
        userId: null,
      };
    }

    // users 테이블에서 role 확인
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        ),
        userId: null,
      };
    }

    const isAuthorized = userData.role === "admin" || userData.role === "sub_admin";

    if (!isAuthorized) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "Only admin and sub_admin can access" },
          { status: 403 }
        ),
        userId: null,
      };
    }

    return {
      authorized: true,
      userId: user.id,
      error: null,
    };
  } catch (error: any) {
    console.error("❌ 권한 체크 에러:", error);
    return {
      authorized: false,
      error: NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      ),
      userId: null,
    };
  }
}

/**
 * 아카이빙 소유권 또는 관리자 권한 검증
 * 작성자 또는 관리자(admin), 부관리자(sub_admin)만 가능
 */
export async function checkArchivingOwnershipOrAdmin(archivingId: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        ),
        userId: null,
      };
    }

    // 아카이빙 정보 조회
    const { data: archivingData, error: archivingError } = await supabase
      .from("archiving")
      .select("author")
      .eq("id", archivingId)
      .single();

    if (archivingError || !archivingData) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "Archiving not found" },
          { status: 404 }
        ),
        userId: null,
      };
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        ),
        userId: null,
      };
    }

    const isOwner = archivingData.author === user.id;
    const isAdmin = userData.role === "admin" || userData.role === "sub_admin";

    if (!isOwner && !isAdmin) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "You do not have permission to modify this archiving" },
          { status: 403 }
        ),
        userId: null,
      };
    }

    return {
      authorized: true,
      userId: user.id,
      error: null,
    };
  } catch (error: any) {
    console.error("❌ 소유권 검증 에러:", error);
    return {
      authorized: false,
      error: NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      ),
      userId: null,
    };
  }
}