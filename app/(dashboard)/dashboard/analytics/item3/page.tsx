import { redirect } from "next/navigation";

export default function LegacyAnalyticsItemPage() {
  redirect("/dashboard/analytics");
}
