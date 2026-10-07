import type { Metadata } from "next";
import { ToastProvider } from "@/components/ToastProvider";
import BalsaThemeActivation from "@/app/components/BalsaThemeActivation";
import Header from "@/app/layout/Header";
import Footer from "@/app/layout/Footer";
import { getSiteSettings, getDefaultMetadata } from "@/lib/site-settings";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";
import "@/styles/balsa-foundation.css";
import "@/styles/balsa-theme.css";
import "@/styles/balsa-palette.css";
import "@/styles/my-design-system-palette.css";
import "@/styles/balsa-shadcn-bridge.css";
import "./css/style.scss";
import "./css/balsa-system.scss";
import "./css/news.css";
import "./css/archive.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const enableVercelInsights = process.env.NEXT_PUBLIC_ENABLE_VERCEL_INSIGHTS === "true";

function normalizeGa4Id(value?: string | null) {
  return value && /^G-[A-Z0-9-]+$/i.test(value) ? value.toUpperCase() : null;
}

function normalizeGtmId(value?: string | null) {
  return value && /^GTM-[A-Z0-9-]+$/i.test(value) ? value.toUpperCase() : null;
}

function normalizeHtmlLang(value?: string | null) {
  return value?.replace("_", "-").split("-")[0] || "ko";
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return getDefaultMetadata(settings);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  const siteUrl = getSiteUrl();
  const ga4Id = normalizeGa4Id(settings?.ga4_id);
  const gtmId = normalizeGtmId(settings?.gtm_id);
  const htmlLang = normalizeHtmlLang(settings?.site_language);

  return (
    <html
      lang={htmlLang}
      data-palette="my-design-system"
      data-theme="my-design-system"
      data-balsa-adapt
    >
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        
        {/* Favicon */}
        {settings?.favicon_url && (
          <link rel="icon" href={settings.favicon_url} />
        )}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="ARCH.B 뉴스와 에디토리얼 RSS"
          href={`${siteUrl}/rss.xml`}
        />
        <meta name="p:domain_verify" content="a1385cca1b4c87b9e9f53b214e8fd264"/>
        
        {/* Apple Touch Icon */}
        {settings?.apple_touch_icon_url && (
          <link rel="apple-touch-icon" href={settings.apple_touch_icon_url} />
        )}
        
        {/* Android Chrome Icons */}
        {settings?.android_icon_192_url && (
          <link
            rel="icon"
            type="image/png"
            sizes="192x192"
            href={settings.android_icon_192_url}
          />
        )}
        {settings?.android_icon_512_url && (
          <link
            rel="icon"
            type="image/png"
            sizes="512x512"
            href={settings.android_icon_512_url}
          />
        )}

        {/* Theme Color */}
        <meta name="theme-color" content={settings?.theme_color || "#1570EF"} />
        <meta name="p:domain_verify" content="bf63e4dfeb108fe297cdffdabe10cd78"/>

        {/* Google Analytics 4 */}
        {ga4Id && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', ${JSON.stringify(ga4Id)});
                `,
              }}
            />
          </>
        )}

        {/* Google Tag Manager */}
        {gtmId && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer',${JSON.stringify(gtmId)});
              `,
            }}
          />
        )}

        {/* ❌ 삭제됨: Custom Scripts (div가 head 안에 있으면 에러 발생) 
           아래 body 태그 안으로 이동했습니다.
        */}

        {/* Structured Data (Schema.org) */}
        {settings?.schema_type === "Organization" && settings.organization_name && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                name: settings.organization_name,
                url: siteUrl,
                logo: settings.logo_url || undefined,
              }),
            }}
          />
        )}
      </head>
      <body className="antialiased">
        <BalsaThemeActivation />
        {/* Google Tag Manager (noscript) */}
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}

        {/* ✅ 이동됨: Custom Scripts (Body 안에서는 div 사용 가능) */}
        {settings?.custom_scripts && (
          <div dangerouslySetInnerHTML={{ __html: settings.custom_scripts }} />
        )}

        <ToastProvider>
          <Header />
          {children}
          <Footer/>
        </ToastProvider>
        
        {enableVercelInsights && (
          <>
            <SpeedInsights />
            <Analytics />
          </>
        )}
      </body>
    </html>
  );
}
