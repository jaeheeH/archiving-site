import { XMLParser, XMLValidator } from "fast-xml-parser";
export const CATEGORIES = { design: "디자인", development: "개발", interiors: "인테리어", editorial: "에디토리얼" } as const;
export type Category = keyof typeof CATEGORIES;
export type Article = { url: string; title: string; description: string; category: Category; source: string; published_at: string; image: string | null; tags: string[]; source_text?: string };
export const FEEDS: { id: string; name: string; category: Category; url: string }[] = [
  { id: "dezeen-design", name: "Dezeen", category: "design", url: "https://www.dezeen.com/design/feed/" },
  { id: "design-milk", name: "Design Milk", category: "design", url: "https://design-milk.com/feed/" },
  { id: "smashing", name: "Smashing Magazine", category: "development", url: "https://www.smashingmagazine.com/feed/" },
  { id: "github", name: "GitHub Changelog", category: "development", url: "https://github.blog/changelog/feed/" },
  { id: "dezeen-interiors", name: "Dezeen Interiors", category: "interiors", url: "https://www.dezeen.com/interiors/feed/" },
];
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, processEntities: true, htmlEntities: true });
const array = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const value = (input: unknown): string => typeof input === "string" ? input : typeof input === "object" && input !== null && "#text" in input ? String(input["#text"]) : "";
export const plainText = (input: unknown) => value(input).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " ").replace(/&#(x[0-9a-f]+|\d+);/gi, (_, digits: string) => { const code = digits[0].toLowerCase() === "x" ? parseInt(digits.slice(1), 16) : Number(digits); return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : ""; }).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&hellip;/g, "…").replace(/\s+/g, " ").trim();
export function canonicalUrl(input: string, base: string): string | null {
  try {
    const url = new URL(input, base);
    if (!input || !["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.href;
  } catch { return null; }
}
export function parseFeed(xml: string, feed: typeof FEEDS[number], now = Date.now()): Article[] {
  xml = xml.trim();
  if (xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")) || XMLValidator.validate(xml) !== true) throw new Error("유효한 RSS/Atom 응답이 아닙니다.");
  const document = parser.parse(xml);
  const items = document.rss?.channel?.item ?? document.feed?.entry;
  if (!items) throw new Error("피드에 뉴스 항목이 없습니다.");
  const seen = new Set<string>();
  return array<Record<string, unknown>>(items).slice(0, 50).flatMap((item) => {
    const title = plainText(item.title).slice(0, 300);
    const links = array<Record<string, unknown> | string>(item.link as Record<string, unknown> | string[] | undefined);
    const atomLink = links.find((link) => typeof link === "object" && (!link["@_rel"] || link["@_rel"] === "alternate"));
    const link = typeof atomLink === "object" ? String(atomLink["@_href"] ?? "") : value(item.link);
    const url = canonicalUrl(link, feed.url);
    const date = Date.parse(value(item.pubDate ?? item.published ?? item.updated));
    if (!title || !url || !Number.isFinite(date) || date > now + 86_400_000 || seen.has(url)) return [];
    seen.add(url);
    const html = value(item.encoded ?? item.content ?? item.description ?? item.summary);
    const enclosure = item.enclosure as Record<string, unknown> | undefined;
    const thumbnail = item.thumbnail as Record<string, unknown> | undefined;
    const imageContent = item.content as Record<string, unknown> | undefined;
    const rawImage = html.match(/<img\b[^>]*\bsrc=["'](https:[^"']+)["']/i)?.[1] || String(thumbnail?.["@_url"] ?? imageContent?.["@_url"] ?? (String(enclosure?.["@_type"] ?? "").startsWith("image/") ? enclosure?.["@_url"] : "") ?? "");
    const image = canonicalUrl(rawImage.replace(/^http:\/\/(static\.dezeen\.com|archive\.smashing\.media)\//, "https://$1/").replace(/&amp;/g, "&"), feed.url);
    const tags = array(item.category).map((tag) => plainText(tag) || String((tag as Record<string, unknown>)?.["@_term"] ?? "")).filter(Boolean).map((tag) => tag.slice(0, 40));
    const category = feed.id === "design-milk" && tags.some(tag => /interior|workplace|commercial/i.test(tag)) ? "interiors" : feed.category;
    return [{ url, title, description: plainText(item.description ?? item.summary ?? item.content).slice(0, 450), source_text: plainText(html).slice(0, 12000), category, source: feed.name, published_at: new Date(date).toISOString(), image: image?.startsWith("https:") ? image : null, tags: [...new Set(tags)].slice(0, 6) }];
  });
}
export async function fetchFeed(feed: typeof FEEDS[number]) {
  const response = await fetch(feed.url, { headers: { "User-Agent": "ARCH.B/1.0 RSS Reader", Accept: "application/rss+xml, application/atom+xml, application/xml" }, signal: AbortSignal.timeout(15_000), redirect: "manual" });
  if (!response.ok) throw new Error(`수집처 응답: HTTP ${response.status}`);
  if (Number(response.headers.get("content-length")) > 2_000_000) throw new Error("피드 크기 한도를 초과했습니다.");
  // ponytail: five bounded publisher feeds; add streaming parsing if large feeds are needed.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("피드 응답이 비어 있습니다.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 2_000_000) { await reader.cancel(); throw new Error("피드 크기 한도를 초과했습니다."); }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const articles = parseFeed(new TextDecoder().decode(bytes), feed);
  if (!articles.length) throw new Error("유효한 제목·링크·발행일을 가진 뉴스가 없습니다.");
  return articles;
}
