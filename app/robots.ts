import { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/site-settings";
import { getSiteUrl } from "@/lib/site-url";
import { isSearchPreview } from '@/lib/seo';

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettings();
  const baseUrl = getSiteUrl();

  // robots_allow가 false면 모든 크롤링 차단
  if (settings?.robots_allow === false || isSearchPreview()) {
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
        allow: ["/", "/api/og"],
        disallow: ["/dashboard", "/api/", "/mypage", "/auth/", "/extension/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
