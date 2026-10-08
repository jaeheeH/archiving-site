export type DuplicateCandidate = {
  id: string; slug: string; title: string; summary: string | null; is_published: boolean;
  original_title: string | null; source_url: string | null; source: string | null; source_published_at: string | null;
};
export type DuplicateMatch = Pick<DuplicateCandidate, 'id' | 'slug' | 'title' | 'source' | 'is_published'> & { reason: string };
export type DuplicateReview = { status: 'pending' | 'allowed' | 'excluded'; checked_at: string; matches: DuplicateMatch[]; reviewed_at?: string; reviewed_by?: string };
export type DuplicateInput = { url: string; title: string; source: string; sourceText?: string; publishedAt?: string };

export class DuplicateNewsError extends Error {
  constructor(public matches: DuplicateMatch[]) { super('기존 기사와 같은 소식일 수 있어 작성 전 확인이 필요합니다.'); }
}

const normalizedTitle = (title: string) => title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export function duplicateUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.replace(/^www\./, '');
    url.pathname = url.pathname.replace(/^\/(?:en|ko|kr|ja|zh)(?:-[a-z]{2})?\//i, '/').replace(/\/$/, '');
    for (const key of [...url.searchParams.keys()]) if (/^(?:utm_.+|fbclid|gclid|lang|locale)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.href;
  } catch { return ''; }
}
export function exactDuplicate(input: DuplicateInput, candidate: DuplicateCandidate) {
  const title = normalizedTitle(input.title);
  if (duplicateUrl(input.url) && duplicateUrl(input.url) === duplicateUrl(candidate.source_url || '')) return '언어·추적 주소를 제외하면 같은 원문 주소입니다.';
  if (title.length >= 12 && [candidate.title, candidate.original_title].some(other => other && normalizedTitle(other) === title)) return '기존 기사와 원문 제목이 같습니다. 번역본이나 재수집 여부를 확인해주세요.';
  return null;
}
export function duplicateCandidates(input: DuplicateInput, existing: DuplicateCandidate[]) {
  const words = new Set(input.title.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)?.filter(word => !['the','and','for','with','from','new','this','that','into','its','how','are'].includes(word)) || []);
  return existing.map(candidate => {
    const text = `${candidate.original_title || ''} ${candidate.title}`.normalize('NFKC').toLowerCase();
    const overlap = [...words].filter(word => text.includes(word)).length;
    const near = Math.abs(Date.parse(input.publishedAt || '') - Date.parse(candidate.source_published_at || '')) <= 14 * 86400_000;
    return { candidate, score: exactDuplicate(input, candidate) ? 1000 : overlap >= 2 ? overlap * 10 + Number(near) : input.source === candidate.source && near ? 1 : 0 };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    // ponytail: compare the 12 strongest candidates; use DB text/vector search if this shortlist misses overlaps in a much larger archive.
    .slice(0, 12).map(item => item.candidate);
}
