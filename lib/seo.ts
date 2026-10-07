import type { Metadata } from 'next';
import { getSiteUrl } from './site-url';

export const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false };
export const isSearchPreview = () => !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production';
export const sitePageUrl = (path: string) => new URL(path, `${getSiteUrl()}/`).href;
export const jsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export function pageMetadata({ path, title, description, image = '/api/og?type=default', noindex = false }: {
  path: string; title: string; description: string; image?: string; noindex?: boolean;
}): Metadata {
  const url = sitePageUrl(path);
  const imageUrl = sitePageUrl(image);
  return {
    title: { absolute: `${title} · ARCH.B` }, description,
    alternates: { canonical: url },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: 'website', title, description, url, siteName: 'ARCH.B', locale: 'ko_KR', images: [{ url: imageUrl, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [imageUrl] },
  };
}

export function breadcrumb(items: { name: string; path: string }[]) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: sitePageUrl(item.path) })) };
}
