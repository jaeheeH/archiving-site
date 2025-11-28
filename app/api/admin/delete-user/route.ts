import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 현재 사용자의 role 확인
    const { data: currentUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    // admin이나 sub-admin만 삭제 가능
    if (currentUser?.role !== "admin" && currentUser?.role !== "sub-admin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // sub-admin은 admin 삭제 불가
    if (currentUser?.role === "sub-admin") {
      const { data: targetUser } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .single();

      if (targetUser?.role === "admin") {
        return NextResponse.json(
          { error: "Cannot delete admin user" },
          { status: 403 }
        );
      }
    }

    // Admin 클라이언트로 삭제
    const adminClient = createAdminClient();

    // auth.users에서 삭제
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("Auth delete error:", authError);
      return NextResponse.json(
        { error: "Failed to delete user" },
        { status: 500 }
      );
    }

    // public.users는 CASCADE로 자동 삭제되거나 수동 삭제
    await supabase.from("users").delete().eq("id", userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}