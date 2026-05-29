import { redirect } from "next/navigation";

export default function LegacySettingsEtcPage() {
  redirect("/dashboard/settings");
}
