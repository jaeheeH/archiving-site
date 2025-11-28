// app/(dashboard)/dashboard/users/page.tsx

import DashboardTitle from "@/app/(dashboard)/components/DashboardHeader";
import { createClient } from "@/lib/supabase/server";
import UserList from "./components/UserList";
import "../../css/users.scss";


export default async function Users() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: currentUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user?.id)
    .single();

  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <header className="dashboard-Header">
        <DashboardTitle title="사용자 관리" />
      </header>
      <div className="dashboard-container">
        <UserList
          users={users || []}
          currentUserRole={currentUser?.role || "user"}
          currentUserId={user?.id || ""}
        />
      </div>
    </div>
  );
}