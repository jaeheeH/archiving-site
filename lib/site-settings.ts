import { createClient } from "@/lib/supabase/server";

export type SiteSettings = {
  id: string;
  site_name: string;
  site_description: string | null;
  site_keywords: string[] | null;
  site_language: string;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  og_type: string;
  twitter_card_type: string;
  twitter_title: string | null;
  twitter_description: string | null;
  twitter_image: string | null;
  favicon_url: string | null;
  apple_touch_icon_url: string | null;
  android_icon_192_url: string | null;
  android_icon_512_url: string | null;
  robots_allow: boolean;
  google_verification: string | null;
  naver_verification: string | null;
  sitemap_revalidate: number;
  schema_type: string;
  organization_name: string | null;
  logo_url: string | null;
  ga4_id: string | null;
  gtm_id: string | null;
  custom_scripts: string | null;
  theme_color: string;
  canonical_enabled: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

/**
 * 사이트 설정 가져오기 (서버 컴포넌트용)
 */
export async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .single();

    if (error) {
      console.error("❌ Site settings 조회 에러:", error);
      return null;
    }

    return data as SiteSettings;
  } catch (error) {
    console.error("❌ Site settings 조회 실패:", error);
    return null;
  }
}

/**
 * 기본 메타데이터 생성
 */
export function getDefaultMetadata(settings: SiteSettings | null) {
  const siteName = settings?.site_name || "Archiving";
  const siteDescription =
    settings?.site_description ||
    "다양한 디자인과 아이디어를 한곳에 모았습니다.";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://from-archiving.vercel.app";

  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description: siteDescription,
    keywords: settings?.site_keywords || [
      "디자인",
      "아카이빙",
      "갤러리",
      "블로그",
    ],
    openGraph: {
      type: "website",
      locale: settings?.site_language || "ko_KR",
      url: siteUrl,
      siteName: siteName,
      title: settings?.og_title || siteName,
      description: settings?.og_description || siteDescription,
      images: settings?.og_image
        ? [
            {
              url: settings.og_image,
              width: 1200,
              height: 630,
              alt: siteName,
            },
          ]
        : [],
    },
    twitter: {
      card: settings?.twitter_card_type || "summary_large_image",
      title: settings?.twitter_title || siteName,
      description: settings?.twitter_description || siteDescription,
      images: settings?.twitter_image ? [settings.twitter_image] : [],
    },
    robots: settings?.robots_allow
      ? {
          index: true,
          follow: true,
        }
      : {
          index: false,
          follow: false,
        },
    verification: {
      google: settings?.google_verification || undefined,
      other: {
        "naver-site-verification": settings?.naver_verification || undefined,
      },
    },
    icons: {
      icon: settings?.favicon_url || "/favicon.ico",
      apple: settings?.apple_touch_icon_url || undefined,
    },
    other: {
      "theme-color": settings?.theme_color || "#1570EF",
    },
  };
}