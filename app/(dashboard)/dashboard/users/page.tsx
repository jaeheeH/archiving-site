// app/(dashboard)/dashboard/users/page.tsx

import DashboardTitle from "@/app/(dashboard)/components/DashboardHeader";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import UserList from "./components/UserList";
import "../../css/users.scss";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Users() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/users");
  }

  const admin = createAdminClient();

  const { data: currentUser } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentUser?.role !== "admin" && currentUser?.role !== "sub-admin") {
    redirect("/no-access");
  }

  let usersQuery = admin
    .from("users")
    .select("id, email, role, nickname, name, avatar_url, phone, tel, created_at, last_login_at, status")
    .order("created_at", { ascending: false });

  if (currentUser.role === "sub-admin") {
    usersQuery = usersQuery.neq("role", "admin");
  }

  const { data: users } = await usersQuery;

  return (
    <div>
      <header className="dashboard-Header">
        <DashboardTitle title="사용자 관리" />
      </header>
      <div className="dashboard-container">
        <UserList
          users={users || []}
          currentUserRole={currentUser?.role || "user"}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
