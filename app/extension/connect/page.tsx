import type { Metadata } from "next";
import { PRIVATE_ROBOTS } from '@/lib/seo';

import ExtensionConnectClient from "./ExtensionConnectClient";

export const metadata: Metadata = {
  title: "Chrome Extension Connect | ARCH-B",
  description: "ARCH-B 크롬 확장자를 연결합니다.",
  robots: PRIVATE_ROBOTS,
};

export default function ExtensionConnectPage() {
  return <ExtensionConnectClient />;
}
