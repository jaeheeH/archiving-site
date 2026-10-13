import { queryText } from './search-text';

export const ART_PERIODS = [
  { id: 'early-modern', label: '근세 · 15–18세기' },
  { id: 'modern', label: '근대 · 19세기' },
  { id: '20th-century', label: '20세기' },
  { id: 'joseon', label: '한국 · 조선' },
  { id: 'edo', label: '일본 · 에도' },
] as const;
export const ART_MOVEMENTS = [
  { id: 'renaissance', label: '르네상스', periods: ['early-modern'] },
  { id: 'baroque', label: '바로크', periods: ['early-modern'] },
  { id: 'neoclassicism', label: '신고전주의', periods: ['early-modern', 'modern'] },
  { id: 'romanticism', label: '낭만주의', periods: ['modern'] },
  { id: 'realism', label: '사실주의', periods: ['modern'] },
  { id: 'impressionism', label: '인상주의', periods: ['modern', '20th-century'] },
  { id: 'post-impressionism', label: '후기인상주의', periods: ['modern', '20th-century'] },
  { id: 'symbolism', label: '상징주의', periods: ['modern', '20th-century'] },
  { id: 'ukiyo-e', label: '우키요에', periods: ['edo'] },
  { id: 'rinpa', label: '린파', periods: ['edo'] },
] as const;
export const ART_KINDS = [
  { id: 'painting', label: '회화' },
  { id: 'print', label: '판화' },
  { id: 'drawing', label: '드로잉' },
  { id: 'sculpture', label: '조각' },
] as const;
export const ART_SUBJECTS = [
  { id: 'landscape', label: '풍경' },
  { id: 'interior', label: '실내' },
  { id: 'figure', label: '인물' },
  { id: 'still-life', label: '정물' },
  { id: 'daily-life', label: '일상' },
  { id: 'nature', label: '동식물' },
  { id: 'religion-myth', label: '종교·신화' },
  { id: 'history', label: '역사·사건' },
  { id: 'performance', label: '음악·공연' },
  { id: 'imagination', label: '꿈·상상' },
] as const;

export type ArtTaxonomy = {
  periods: string[];
  movements: string[];
  kind: string;
  subjects: string[];
  sources: { label: string; url: string }[];
};
export type ArtFilterParams = Partial<Record<'q' | 'artist' | 'museum' | 'period' | 'movement' | 'kind' | 'subject', string | string[]>>;
export function readArtFilters(params: ArtFilterParams) {
  const subject = params.subject ? Array.isArray(params.subject) ? params.subject : [params.subject] : [];
  return {
    q: queryText(params.q).slice(0, 100).trim(),
    artist: queryText(params.artist).slice(0, 100),
    museum: queryText(params.museum).slice(0, 300),
    period: queryText(params.period).slice(0, 100),
    movement: queryText(params.movement).slice(0, 100),
    kind: queryText(params.kind).slice(0, 100),
    subjects: [...new Set(subject.filter(Boolean).map(value => value.slice(0, 100)))].slice(0, 10),
  };
}
export type ArtFilters = ReturnType<typeof readArtFilters>;
export function artFilterOptions(works: { taxonomy?: ArtTaxonomy }[]) {
  return {
    periods: [...new Set(works.flatMap(work => work.taxonomy?.periods || []))],
    movements: [...new Set(works.flatMap(work => work.taxonomy?.movements || []))],
    kinds: [...new Set(works.map(work => work.taxonomy?.kind || '').filter(Boolean))],
    subjects: [...new Set(works.flatMap(work => work.taxonomy?.subjects || []))],
  };
}
export function hasArtFilters(filters: ArtFilters) {
  return !!(filters.q || filters.artist || filters.museum || filters.period || filters.movement || filters.kind || filters.subjects.length);
}
export function matchesArtFilters(work: { artist_ids: string[]; museum: string; taxonomy?: ArtTaxonomy }, filters: ArtFilters) {
  const taxonomy = work.taxonomy;
  return (!filters.artist || work.artist_ids.includes(filters.artist)) &&
    (!filters.museum || work.museum === filters.museum) &&
    (!filters.period || !!taxonomy?.periods.includes(filters.period)) &&
    (!filters.movement || !!taxonomy?.movements.includes(filters.movement)) &&
    (!filters.kind || taxonomy?.kind === filters.kind) &&
    (!filters.subjects.length || filters.subjects.some(subject => taxonomy?.subjects.includes(subject)));
}
export function artTaxonomyTags(taxonomy?: ArtTaxonomy | ArtTaxonomy[]) {
  if (!taxonomy) return [];
  const records = Array.isArray(taxonomy) ? taxonomy : [taxonomy];
  return [
    ...ART_PERIODS.filter(item => records.some(record => record.periods.includes(item.id))).map(item => ({ ...item, group: 'period' })),
    ...ART_MOVEMENTS.filter(item => records.some(record => record.movements.includes(item.id))).map(item => ({ id: item.id, label: item.label, group: 'movement' })),
    ...ART_KINDS.filter(item => records.some(record => record.kind === item.id)).map(item => ({ ...item, group: 'kind' })),
    ...ART_SUBJECTS.filter(item => records.some(record => record.subjects.includes(item.id))).map(item => ({ ...item, group: 'subject' })),
  ];
}
