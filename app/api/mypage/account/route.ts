import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    await Promise.allSettled([
      admin.from("post_scraps").delete().eq("user_id", user.id),
      admin.from("gallery_scraps").delete().eq("user_id", user.id),
      admin.from("reference_scraps").delete().eq("user_id", user.id),
    ]);

    const { error: authError } = await admin.auth.admin.deleteUser(user.id);

    if (authError) {
      console.error("Mypage account delete auth error:", authError.message);
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    await admin.from("users").delete().eq("id", user.id);
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mypage account delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
