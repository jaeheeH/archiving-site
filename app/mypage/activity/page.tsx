import { redirect } from "next/navigation";

import { getMypageActivity } from "@/lib/mypage-data";
import ActivityTab from "../components/ActivityTab";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const activity = await getMypageActivity();

  if (!activity) {
    redirect("/login");
  }

  return <ActivityTab initialGalleries={activity.galleries} initialReferences={activity.references} />;
}
