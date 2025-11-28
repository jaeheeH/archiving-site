import { NextResponse } from "next/server";
import { createClient } from "./server";

/**
 * 현재 사용자의 role 확인
 * admin, sub-admin, editor 권한이 있는지 체크
 */
export async function checkGalleryEditPermission() {
  try {
    const supabase = await createClient();

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        authorized: false,
        userId: null,
        role: null,
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    // users 테이블에서 role 확인
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = userData?.role;
    const isEditor = ["admin", "sub-admin", "editor"].includes(role);

    if (!isEditor) {
      return {
        authorized: false,
        userId: user.id,
        role,
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }

    return {
      authorized: true,
      userId: user.id,
      role,
      error: null,
    };
  } catch (error) {
    console.error("❌ 권한 검증 에러:", error);
    return {
      authorized: false,
      userId: null,
      role: null,
      error: NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      ),
    };
  }
}

/**
 * 현재 사용자가 특정 gallery의 작성자인지 또는 관리자인지 확인
 */
export async function checkGalleryOwnershipOrAdmin(galleryId: number) {
  try {
    const supabase = await createClient();

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        authorized: false,
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    // users 테이블에서 role 확인
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = userData?.role;
    const isAdmin = ["admin", "sub-admin"].includes(role);

    // admin/sub-admin이면 권한 있음
    if (isAdmin) {
      return { authorized: true, error: null };
    }

    // gallery 작성자 확인
    const { data: gallery } = await supabase
      .from("gallery")
      .select("author")
      .eq("id", galleryId)
      .single();

    if (!gallery) {
      return {
        authorized: false,
        error: NextResponse.json({ error: "Gallery not found" }, { status: 404 }),
      };
    }

    // 작성자인지 확인
    if (gallery.author !== user.id) {
      return {
        authorized: false,
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }

    return { authorized: true, error: null };
  } catch (error) {
    console.error("❌ 권한 검증 에러:", error);
    return {
      authorized: false,
      error: NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      ),
    };
  }
}