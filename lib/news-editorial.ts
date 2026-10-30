import { z } from "zod";
export const NEWS_BODY_LIMITS = { min: 900, max: 4000, minSections: 3, maxSections: 8 } as const;
const koreanText = (min: number, max: number) => z.string().trim().min(min).max(max).refine(value => /[가-힣]/.test(value), "한국어로 작성해주세요.");
const section = z.object({
  heading: z.union([z.literal(""), koreanText(2, 80)]), kind: z.enum(["reporting", "analysis"]),
  paragraphs: z.array(koreanText(30, 1000)).min(1).max(4),
  references: z.array(z.object({ label: koreanText(2, 100), kind: z.enum(["primary", "reporting"]).default("reporting"), url: z.string().url().max(2000).refine(value => { try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; } }) }).strict()).max(9).default([]),
}).strict();
export function editorialText(paragraphs: (string | { paragraphs: string[] })[]) { return paragraphs.flatMap(p => typeof p === "string" ? [p] : p.paragraphs).join(" "); }
export const editorialSchema = z.object({
  url: z.string().url().max(2000),
  title: koreanText(8, 160), summary: koreanText(30, 350),
  paragraphs: z.array(z.union([koreanText(30, 1000), section])).min(2).max(12),
  points: z.array(koreanText(8, 200)).min(2).max(4),
  tags: z.array(z.string().trim().min(1).max(30)).min(1).max(5),
}).strict().superRefine((value, context) => {
  const length = editorialText(value.paragraphs).length;
  if (length < NEWS_BODY_LIMITS.min || length > NEWS_BODY_LIMITS.max) context.addIssue({ code: "custom", path: ["paragraphs"], message: "본문은 900~4,000자로 작성해주세요." });
  if (value.paragraphs.length < NEWS_BODY_LIMITS.minSections || value.paragraphs.length > NEWS_BODY_LIMITS.maxSections || value.paragraphs.some(p => typeof p === "string")) context.addIssue({ code: "custom", path: ["paragraphs"], message: "사실과 분석을 구분한 3~8개 섹션이 필요합니다." });
  const sections = value.paragraphs.filter(p => typeof p !== "string");
  if (!sections.some(p => p.kind === "reporting") || !sections.some(p => p.kind === "analysis")) context.addIssue({ code: "custom", path: ["paragraphs"], message: "사실·소식과 ARCH.B 분석을 각각 포함해주세요." });
  const referenceRows = sections.flatMap(p => p.references);
  const referenceKey = (url: string) => { const parsed = new URL(url); parsed.hash = ''; parsed.hostname = parsed.hostname.replace(/^www\./, ''); parsed.pathname = parsed.pathname.replace(/\/$/, '') || '/'; for (const key of [...parsed.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) parsed.searchParams.delete(key); parsed.searchParams.sort(); return parsed.href.replace(/%[0-9a-f]{2}/gi, code => code.toUpperCase()); };
  const references = new Set(referenceRows.map(ref => referenceKey(ref.url)));
  if (!referenceRows.some(ref => ref.kind === "primary")) context.addIssue({ code: "custom", path: ["paragraphs"], message: "검토한 공식 1차 자료를 하나 이상 포함해주세요." });
  if (references.size < 2 || !references.has(referenceKey(value.url))) context.addIssue({ code: "custom", path: ["paragraphs"], message: "원출처를 포함한 서로 다른 참고자료 2개 이상이 필요합니다." });
});
export const editorialBatchSchema = z.object({ articles: z.array(editorialSchema).min(1).max(20) }).strict()
  .refine(value => new Set(value.articles.map(a => a.url)).size === value.articles.length, "중복된 기사가 있습니다.");
export type Editorial = z.infer<typeof editorialSchema>;
export function editorialReferences(url: string, title: string, paragraphs: Editorial['paragraphs']) {
  const sources = new Map<string, { url: string; label: string; kind: 'primary' | 'reporting' }>();
  sources.set(url, { url, label: title, kind: 'reporting' });
  for (const section of paragraphs) {
    if (typeof section === 'string') continue;
    for (const reference of section.references) {
      const existing = sources.get(reference.url);
      if (!existing) sources.set(reference.url, { ...reference });
      else if (reference.kind === 'primary') existing.kind = 'primary';
    }
  }
  return [...sources.values()];
}
const draftText = (max: number) => z.string().trim().max(max);
const draftEditorialSchema = z.object({
  url: z.string().url().max(2000), title: draftText(160).min(1), summary: draftText(350),
  paragraphs: z.array(z.union([draftText(1000), section.extend({ heading: draftText(80), paragraphs: z.array(draftText(1000)).max(4), references: z.array(z.object({ label: draftText(100), kind: z.enum(["primary", "reporting"]).default("reporting"), url: z.union([z.literal(""), section.shape.references.unwrap().element.shape.url]) }).strict()).max(9).default([]) })])).max(12),
  points: z.array(draftText(200)).max(4), tags: z.array(draftText(30).min(1)).max(5),
}).strict().refine(value => editorialText(value.paragraphs).length <= 8000, "본문이 너무 깁니다.");
const thumbnailUrlSchema = z.string().trim().max(2000).url().refine(value => {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'overgjynkrnwayfammid.supabase.co' && !url.username && !url.password && !url.port && url.pathname.startsWith('/storage/v1/object/public/posts/'); } catch { return false; }
}, '업로드한 뉴스 썸네일 주소가 필요합니다.');
export const newsEditSchema = z.object({ article: draftEditorialSchema, is_published: z.boolean(), thumbnail_url: thumbnailUrlSchema.nullable().optional(), thumbnail_credit: z.string().trim().max(200).optional() }).strict().superRefine((value, context) => {
  if (!value.is_published) return;
  const parsed = editorialSchema.safeParse(value.article);
  if (!parsed.success) for (const issue of parsed.error.issues) context.addIssue({ ...issue, path: ["article", ...issue.path] });
});
