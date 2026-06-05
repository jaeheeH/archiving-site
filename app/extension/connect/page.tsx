import type { Metadata } from "next";

import ExtensionConnectClient from "./ExtensionConnectClient";

export const metadata: Metadata = {
  title: "Chrome Extension Connect | ARCH-B",
  description: "ARCH-B 크롬 확장자를 연결합니다.",
};

export default function ExtensionConnectPage() {
  return <ExtensionConnectClient />;
}
