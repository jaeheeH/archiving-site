import { redirect } from "next/navigation";

import { getMypageProfile } from "@/lib/mypage-data";
import ProfileTab from "../components/ProfileTab";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getMypageProfile();

  if (!user) {
    redirect("/login?redirect=/mypage/profile");
  }

  return <ProfileTab user={user} />;
}
