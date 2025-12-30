import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ToastProvider";
import Header from "@/app/layout/Header";
import { getSiteSettings, getDefaultMetadata } from "@/lib/site-settings";
import "./globals.css";
import "./css/style.scss";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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

  return (
    <html lang={settings?.site_language || "ko"}>
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

        {/* Google Analytics 4 */}
        {settings?.ga4_id && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${settings.ga4_id}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${settings.ga4_id}');
                `,
              }}
            />
          </>
        )}

        {/* Google Tag Manager */}
        {settings?.gtm_id && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${settings.gtm_id}');
              `,
            }}
          />
        )}

        {/* Custom Scripts */}
        {settings?.custom_scripts && (
          <div dangerouslySetInnerHTML={{ __html: settings.custom_scripts }} />
        )}

        {/* Structured Data (Schema.org) */}
        {settings?.schema_type === "Organization" && settings.organization_name && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                name: settings.organization_name,
                url: process.env.NEXT_PUBLIC_SITE_URL || "https://from-archiving.vercel.app",
                logo: settings.logo_url || undefined,
              }),
            }}
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Google Tag Manager (noscript) */}
        {settings?.gtm_id && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${settings.gtm_id}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}

        <ToastProvider>
          <Header />
          {children}
        </ToastProvider>
        
        {/* Vercel Analytics */}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}