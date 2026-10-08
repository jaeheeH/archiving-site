import { unstable_cache } from "next/cache";
import { CACHE_SECONDS, CACHE_TAGS } from "@/lib/public-data";
import { getSiteUrl } from "@/lib/site-url";
import { SITE_COPY } from "@/lib/site-copy";
import { createPublicClient } from "@/lib/supabase/public";
import { isSearchPreview, pageMetadata, sitePageUrl } from '@/lib/seo';

export type SiteSettings = {
  updated_at?: string | null;
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
  schema_type: string;
  organization_name: string | null;
  logo_url: string | null;
  ga4_id: string | null;
  gtm_id: string | null;
  custom_scripts: string | null;
  theme_color: string;
};

const PUBLIC_SITE_SETTINGS_COLUMNS = `
  updated_at,
  site_name,
  site_description,
  site_keywords,
  site_language,
  og_title,
  og_description,
  og_image,
  og_type,
  twitter_card_type,
  twitter_title,
  twitter_description,
  twitter_image,
  favicon_url,
  apple_touch_icon_url,
  android_icon_192_url,
  android_icon_512_url,
  robots_allow,
  google_verification,
  naver_verification,
  schema_type,
  organization_name,
  logo_url,
  ga4_id,
  gtm_id,
  custom_scripts,
  theme_color
`;

const getCachedSiteSettings = unstable_cache(
  async (): Promise<SiteSettings | null> => {
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("site_settings")
      .select(PUBLIC_SITE_SETTINGS_COLUMNS)
      .single();

    if (error) {
      if (error.code !== "PGRST116") {
        console.error("Site settings 조회 에러:", error);
      }
      return null;
    }

    return data as SiteSettings;
  },
  ["site-settings-v2"],
  {
    revalidate: CACHE_SECONDS.medium,
    tags: [CACHE_TAGS.siteSettings],
  }
);

/**
 * 사이트 설정 가져오기 (공개 레이아웃/메타데이터용)
 */
export async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    return await getCachedSiteSettings();
  } catch (error) {
    console.error("Site settings 조회 실패:", error);
    return null;
  }
}

export async function getPageMetadata(options: Parameters<typeof pageMetadata>[0]) {
  const settings = await getSiteSettings();
  let image = options.image || settings?.og_image || '/api/og?type=default';
  if (image.startsWith('/api/og?') && !image.includes('&v=')) image += `&v=2-${encodeURIComponent(settings?.updated_at || 'default')}`;
  const metadata = pageMetadata({ ...options, image });
  if (!options.image && settings?.twitter_image) metadata.twitter = { ...metadata.twitter, images: [sitePageUrl(settings.twitter_image)] };
  return metadata;
}

/**
 * 기본 메타데이터 생성
 */
export function getDefaultMetadata(settings: SiteSettings | null) {
  const siteName = settings?.site_name || SITE_COPY.brand.name;
  const siteDescription =
    settings?.site_description ||
    `${SITE_COPY.brand.statement} ${SITE_COPY.brand.description}`;
  const siteUrl = getSiteUrl();
  const defaultOgImage = `${siteUrl}/api/og?type=default&v=2-${encodeURIComponent(settings?.updated_at || 'default')}`;
  const ogImage = settings?.og_image || defaultOgImage;
  const twitterImage = settings?.twitter_image || ogImage;

  // verification.other 객체 생성 (undefined 제거)
  const verificationOther: { [key: string]: string } = {};
  if (settings?.naver_verification) {
    verificationOther["naver-site-verification"] = settings.naver_verification;
  }

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description: siteDescription,
    keywords: settings?.site_keywords || [
      "디자인",
      "아카이빙",
      "갤러리",
      "뉴스", "예술", "작가", "인테리어", "개발",
    ],
    openGraph: {
      type: "website",
      locale: settings?.site_language || "ko_KR",
      url: siteUrl,
      siteName: siteName,
      title: settings?.og_title || siteName,
      description: settings?.og_description || siteDescription,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: siteName,
        },
      ],
    },
    twitter: {
      card: (settings?.twitter_card_type as "summary" | "summary_large_image") || "summary_large_image",
      title: settings?.twitter_title || siteName,
      description: settings?.twitter_description || siteDescription,
      images: [twitterImage],
    },
    robots: settings?.robots_allow !== false && !isSearchPreview()
      ? {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, 'max-image-preview': 'large' as const, 'max-snippet': -1, 'max-video-preview': -1 },
        }
      : {
          index: false,
          follow: false,
        },
    verification: {
      google: settings?.google_verification || undefined,
      other: Object.keys(verificationOther).length > 0 ? verificationOther : undefined,
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
