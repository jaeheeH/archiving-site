import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/error-message";
import { isUuidParam } from "@/lib/route-params";

export async function DELETE(request: Request) {
  try {
    let body: { userId?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request" }, { status: 400 });
    }

    const { userId } = body;

    if (typeof userId !== "string" || !isUuidParam(userId)) {
      return NextResponse.json(
        { error: "Valid user ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 현재 사용자의 role 확인
    if (user.id === userId) {
      return NextResponse.json(
        { error: "Cannot delete yourself" },
        { status: 403 }
      );
    }

    const { data: currentUser, error: currentUserError } = await adminClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    // admin이나 sub-admin만 삭제 가능
    if (currentUserError || (currentUser?.role !== "admin" && currentUser?.role !== "sub-admin")) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { data: targetUser, error: targetUserError } = await adminClient
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // sub-admin은 admin 삭제 불가
    if (currentUser?.role === "sub-admin") {
      if (targetUser?.role === "admin") {
        return NextResponse.json(
          { error: "Cannot delete admin user" },
          { status: 403 }
        );
      }
    }

    // auth.users에서 삭제
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

    if (authError) {
      return NextResponse.json(
        { error: getErrorMessage(authError, "Failed to delete user") },
        { status: 500 }
      );
    }

    // public.users는 CASCADE로 자동 삭제되거나 수동 삭제
    await adminClient.from("users").delete().eq("id", userId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
