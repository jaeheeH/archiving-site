export const DEFAULT_SITE_URL = "https://www.archbehind.com";

export function normalizeSiteUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export function getSiteUrl() {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL);
}
