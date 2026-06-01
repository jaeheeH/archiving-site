import { redirect } from "next/navigation";

import { getMypageActivity } from "@/lib/mypage-data";
import ActivityTab from "../components/ActivityTab";

export const dynamic = "force-dynamic";

const VALID_ACTIVITY_TABS = new Set(["blog", "gallery", "reference"]);

function getActivityRedirect(tab: unknown) {
  const selectedTab = typeof tab === "string" && VALID_ACTIVITY_TABS.has(tab) ? tab : "";
  return selectedTab
    ? `/login?redirect=/mypage/activity%3Ftab%3D${selectedTab}`
    : "/login?redirect=/mypage/activity";
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : {};
  const activity = await getMypageActivity();

  if (!activity) {
    redirect(getActivityRedirect(params.tab));
  }

  return (
    <ActivityTab
      initialPosts={activity.posts}
      initialGalleries={activity.galleries}
      initialReferences={activity.references}
    />
  );
}
