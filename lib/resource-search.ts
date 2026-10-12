import { normalizeSearch, searchTokens, matchesSearch, queryText } from './search-text';
import { resourceType, type Resource } from './resource';
export function searchPage(resources: Resource[], filters: { q?: string | string[]; type?: string | string[]; page?: string | string[] | number }) {
  const q = queryText(filters.q).slice(0, 100).trim();
  const type = resourceType(filters.type);
  const tokens = searchTokens(q);
  const score = (item: Resource) => tokens.reduce((sum, token) => sum + (normalizeSearch(item.title) === token ? 300 : item.type === 'artist' && normalizeSearch(item.title).endsWith(token) ? 200 : normalizeSearch(item.title).includes(token) ? 100 : normalizeSearch(item.tags.join(' ')).includes(token) ? 40 : 10), 0);
  const matches = resources.filter(item => matchesSearch(q, [item.title, item.description, item.source, item.searchText, ...item.tags]));
  const filtered = matches.filter(item => type === 'all' || item.type === type).sort((a, b) => score(b) - score(a) || (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0) || a.title.localeCompare(b.title, 'ko') || a.id.localeCompare(b.id));
  const totalPages = Math.max(1, Math.ceil(filtered.length / 24));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(queryText(filters.page), 10) || 1));
  return { items: filtered.slice((page - 1) * 24, page * 24), q, type, page, total: filtered.length, totalPages, counts: Object.fromEntries(Object.keys({ all: 0, post: 0, artwork: 0, artist: 0, reference: 0, gallery: 0 }).map(key => [key, key === 'all' ? matches.length : matches.filter(item => item.type === key).length])) };
}
