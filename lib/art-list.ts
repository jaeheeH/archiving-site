import { readArtFilters, type ArtFilterParams } from './art-taxonomy';

export const ART_PAGE_SIZE = 24;
export type ArtListParams = ArtFilterParams & { page?: string | string[] };

export function artListPage(total: number, params: ArtListParams) {
  const input = Array.isArray(params.page) ? params.page[0] : params.page;
  const requested = /^\d+$/.test(input || '') ? Number(input) : 1;
  const page = Math.max(1, Math.min(Number.isSafeInteger(requested) ? requested : 1, Math.max(1, Math.ceil(total / ART_PAGE_SIZE))));
  const shown = Math.min(total, page * ART_PAGE_SIZE);
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(readArtFilters(params))) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item) query.append(name === 'subjects' ? 'subject' : name, item);
    }
  }
  query.set('page', String(page + 1));
  return { page, shown, moreHref: shown < total ? `/art?${query}` : null };
}
