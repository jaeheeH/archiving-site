export function queryText(value: string | string[] | number | undefined) {
  return String((Array.isArray(value) ? value[0] : value) ?? '');
}
export function normalizeSearch(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/gu, '');
}
export function searchTokens(query: string) {
  return query.slice(0, 100).normalize('NFKC').trim().split(/\s+/u).filter(Boolean).map(normalizeSearch);
}
export function matchesSearch(query: string, values: Array<string | null | undefined>) {
  const text = normalizeSearch(values.filter(Boolean).join(' '));
  return searchTokens(query).every(token => text.includes(token));
}
