import { redirect } from "next/navigation";

import { getMypageProfile } from "@/lib/mypage-data";
import AccountTab from "../components/AccountTab";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getMypageProfile();

  if (!user) {
    redirect("/login");
  }

  return <AccountTab email={user.email} />;
}
