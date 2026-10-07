import { XMLParser, XMLValidator } from "fast-xml-parser";
export const CATEGORIES = { design: "디자인", development: "개발", ai: "AI", technology: "제품·기술", interiors: "인테리어", editorial: "에디토리얼" } as const;
export type Category = keyof typeof CATEGORIES;
export type Article = { url: string; title: string; description: string; category: Category; source: string; published_at: string; image: string | null; tags: string[]; source_text?: string };
export const FEEDS: { id: string; name: string; category: Category; url: string }[] = [
  { id: "dezeen-design", name: "Dezeen", category: "design", url: "https://www.dezeen.com/design/feed/" },
  { id: "design-milk", name: "Design Milk", category: "design", url: "https://design-milk.com/feed/" },
  { id: "smashing", name: "Smashing Magazine", category: "development", url: "https://www.smashingmagazine.com/feed/" },
  { id: "github", name: "GitHub Changelog", category: "development", url: "https://github.blog/changelog/feed/" },
  { id: "dezeen-interiors", name: "Dezeen Interiors", category: "interiors", url: "https://www.dezeen.com/interiors/feed/" },
  { id: "toss", name: "토스테크", category: "development", url: "https://toss.tech/rss.xml" },
  { id: "daangn", name: "당근 기술 블로그", category: "development", url: "https://medium.com/feed/daangn" },
  { id: "gccompany", name: "여기어때 기술블로그", category: "development", url: "https://techblog.gccompany.co.kr/feed" },
  { id: "meta-engineering", name: "Meta Engineering", category: "development", url: "https://engineering.fb.com/feed/" },
  { id: "meta", name: "Meta Newsroom", category: "technology", url: "https://about.fb.com/feed/" },
  { id: "google", name: "Google Blog", category: "technology", url: "https://blog.google/rss/" },
  { id: "adobe", name: "Adobe Developers Blog", category: "development", url: "https://blog.developer.adobe.com/rss.xml" },
  { id: "midjourney", name: "Midjourney", category: "ai", url: "https://updates.midjourney.com/rss/" },
  { id: "samsung", name: "삼성전자 뉴스룸", category: "technology", url: "https://news.samsung.com/kr/feed" },
  { id: "apple", name: "Apple Newsroom", category: "technology", url: "https://www.apple.com/newsroom/rss-feed.rss" },
  { id: "microsoft", name: "Microsoft Blog", category: "technology", url: "https://blogs.microsoft.com/feed/" },
  { id: "nvidia", name: "NVIDIA Blog", category: "ai", url: "https://blogs.nvidia.com/feed/" },
  { id: "openai", name: "OpenAI News", category: "ai", url: "https://openai.com/news/rss.xml" },
  { id: "huggingface", name: "Hugging Face", category: "ai", url: "https://huggingface.co/blog/feed.xml" },
  { id: "figma", name: "Figma Blog", category: "design", url: "https://www.figma.com/blog/feed/atom.xml" },
  { id: "linear", name: "Linear", category: "design", url: "https://linear.app/rss/now.xml" },
  { id: "cloudflare", name: "Cloudflare Blog", category: "development", url: "https://blog.cloudflare.com/rss/" },
  { id: "chrome", name: "Chrome for Developers", category: "development", url: "https://developer.chrome.com/static/blog/feed.xml" },
];
const domesticFeeds = new Set(["toss", "daangn", "gccompany"]);
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
    if (/^rss--/.test(url.searchParams.get("source") || "")) url.searchParams.delete("source");
    url.searchParams.sort();
    return url.href;
  } catch { return null; }
}
export function parseFeed(xml: string, feed: typeof FEEDS[number], now = Date.now()): Article[] {
  xml = xml.trim();
  if (xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")) || XMLValidator.validate(xml) !== true) throw new Error("유효한 RSS/Atom 응답이 아닙니다.");
  const document = parser.parse(xml);
  const items = document.rss?.channel?.item ?? document.feed?.entry;
  if (!document.rss?.channel && !document.feed) throw new Error("유효한 RSS/Atom 응답이 아닙니다.");
  const seen = new Set<string>();
  return array<Record<string, unknown>>(items).slice(0, 50).flatMap((item) => {
    const title = plainText(item.title).slice(0, 300);
    const links = array<Record<string, unknown> | string>(item.link as Record<string, unknown> | string[] | undefined);
    const atomLink = links.find((link) => typeof link === "object" && (!link["@_rel"] || link["@_rel"] === "alternate"));
    const link = typeof atomLink === "object" ? String(atomLink["@_href"] ?? "") : value(item.link);
    const url = canonicalUrl(link, feed.url);
    const date = Date.parse(value(item.pubDate ?? item.published ?? item.updated));
    if (!title || !url || !Number.isFinite(date) || date > now + 86_400_000 || date < now - 90 * 86_400_000 || seen.has(url)) return [];
    seen.add(url);
    const html = value(item.encoded ?? item.content ?? item.description ?? item.summary);
    const enclosure = item.enclosure as Record<string, unknown> | undefined;
    const thumbnail = item.thumbnail as Record<string, unknown> | undefined;
    const imageContent = item.content as Record<string, unknown> | undefined;
    const rawImage = html.match(/<img\b[^>]*\bsrc=["'](https:[^"']+)["']/i)?.[1] || String(thumbnail?.["@_url"] ?? imageContent?.["@_url"] ?? (String(enclosure?.["@_type"] ?? "").startsWith("image/") ? enclosure?.["@_url"] : "") ?? "");
    const image = canonicalUrl(rawImage.replace(/^http:\/\/(static\.dezeen\.com|archive\.smashing\.media)\//, "https://$1/").replace(/&amp;/g, "&"), feed.url);
    const tags = array(item.category).map((tag) => plainText(tag) || String((tag as Record<string, unknown>)?.["@_term"] ?? "")).filter(Boolean).map((tag) => tag.slice(0, 40));
    const sourceText = plainText(html).slice(0, 12000);
    const description = (plainText(item.description ?? item.summary) || sourceText).slice(0, 450);
    const cultureTag = /^(기업문화|조직문화|채용|culture|culture-and-benefit|benefit)$/i;
    if (domesticFeeds.has(feed.id) && tags.some(tag => cultureTag.test(tag)) && tags.every(tag => cultureTag.test(tag) || tag === "여기어때")) return [];
    // ponytail: title/summary and author-intro hints fill missing RSS categories; add publisher metadata if finer classification is needed.
    const domesticDesign = domesticFeeds.has(feed.id) && (tags.some(tag => /^(design|ux|ui|ux-design|product-design|brand-design|브랜드디자인|디자인)$/i.test(tag)) || (feed.id === "toss" && (/디자이너|디자인|사용자 경험|\b(?:UX|UI)\b|브랜딩|캐릭터|아이콘/i.test(`${title} ${description}`) || /\bDesigner\b|디자이너/i.test(sourceText.slice(0, 500)))));
    const aiTopic = /\b(?:AI|artificial intelligence|generative|LLM|GPT[-\d]*|Gemini|Claude|Llama|Firefly|Midjourney|diffusion model|machine learning)\b|인공지능|생성형|언어 모델|머신러닝/i.test(`${title} ${tags.join(" ")}`);
    const designTopic = domesticDesign || tags.some(tag => /^(design|ux|ui|ux-design|product-design|brand-design|디자인)$/i.test(tag));
    const category = aiTopic ? "ai" : designTopic ? "design" : feed.id === "design-milk" && tags.some(tag => /interior|workplace|commercial/i.test(tag)) ? "interiors" : feed.category;
    return [{ url, title, description, source_text: sourceText, category, source: feed.name, published_at: new Date(date).toISOString(), image: image?.startsWith("https:") ? image : null, tags: [...new Set(tags)].slice(0, 6) }];
  }).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at)).slice(0, 20);
}
export async function fetchFeed(feed: typeof FEEDS[number]) {
  const response = await fetch(feed.url, { headers: { "User-Agent": "ARCH.B/1.0 RSS Reader", Accept: "application/rss+xml, application/atom+xml, application/xml" }, signal: AbortSignal.timeout(15_000), redirect: "manual" });
  if (!response.ok) throw new Error(`수집처 응답: HTTP ${response.status}`);
  if (Number(response.headers.get("content-length")) > 2_000_000) throw new Error("피드 크기 한도를 초과했습니다.");
  // ponytail: bounded publisher feeds; add streaming parsing if large feeds are needed.
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
  return articles;
}
