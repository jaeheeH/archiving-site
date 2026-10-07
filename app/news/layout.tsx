import type { Metadata } from "next";
import "@/app/css/news.css";
export const metadata: Metadata = { title: { absolute: "ARCH.B 뉴스 · 디자인, 개발, 인테리어" }, description: "디자인·개발·인테리어의 새로운 소식을 한국어로 가공하고 배경과 실무 관점을 함께 전합니다." };
export default function NewsLayout({ children }: { children: React.ReactNode }) { return children; }
