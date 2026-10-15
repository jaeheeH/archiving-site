import { readArtFilters, type ArtFilterParams } from './art-taxonomy';

export const ART_PAGE_SIZE = 24;
export type ArtListParams = ArtFilterParams & { page?: string | string[] };

export function artListHref(params: ArtListParams, page = 1) {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(readArtFilters(params))) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item) query.append(name === 'subjects' ? 'subject' : name, item);
    }
  }
  if (page > 1) query.set('page', String(page));
  return query.size ? `/art?${query}` : '/art';
}

export function artListPage(total: number, params: ArtListParams) {
  const input = Array.isArray(params.page) ? params.page[0] : params.page;
  const requested = /^\d+$/.test(input || '') ? Number(input) : 1;
  const page = Math.max(1, Math.min(Number.isSafeInteger(requested) ? requested : 1, Math.max(1, Math.ceil(total / ART_PAGE_SIZE))));
  const shown = Math.min(total, page * ART_PAGE_SIZE);
  return { page, shown, moreHref: shown < total ? artListHref(params, page + 1) : null };
}

export function artReturnHref(value: string | null) {
  return value === '/art' || value?.startsWith('/art?') || value?.startsWith('/art#') ? value : '/art';
}
