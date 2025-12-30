import { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/site-settings";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettings();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://from-archiving.vercel.app";

  // robots_allow가 false면 모든 크롤링 차단
  if (settings && !settings.robots_allow) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  // 기본 설정: 대시보드만 차단
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}