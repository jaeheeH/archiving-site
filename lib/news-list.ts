import type { NewsArticle } from './news-record';
import { CATEGORIES } from './news-feeds';
export type NewsSummary = Omit<NewsArticle, 'paragraphs' | 'points' | 'source_text'>;
export type NewsFilters = { page?: string | number; category?: string; q?: string; source?: string; collection?: string };
export const NEWS_PAGE_SIZE = 24;
export function newsPage(articles: NewsSummary[], filters: NewsFilters) {
  const category = filters.category && Object.hasOwn(CATEGORIES, filters.category) ? filters.category : 'all';
  const q = (filters.q || '').slice(0, 100).trim();
  const source = (filters.source || '').slice(0, 100);
  const collection = (filters.collection || '').slice(0, 100);
  const filtered = articles.filter(a => (category === 'all' || a.category === category) && (!source || a.source === source) && (!collection || a.collection === collection) && `${a.title} ${a.description} ${a.source} ${a.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / NEWS_PAGE_SIZE));
  const requestedPage = Math.min(10000, Math.max(1, Number.parseInt(String(filters.page || 1), 10) || 1));
  const page = Math.min(requestedPage, totalPages);
  return { articles: filtered.slice((page - 1) * NEWS_PAGE_SIZE, page * NEWS_PAGE_SIZE), filters: { category, q, source, collection }, requestedPage, pagination: { page, limit: NEWS_PAGE_SIZE, total: filtered.length, totalPages } };
}
export function newsListUrl(filters: NewsFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && !(key === 'category' && value === 'all') && !(key === 'page' && Number(value) <= 1)) params.set(key, String(value));
  }
  return `/news/stories${params.size ? `?${params}` : ''}`;
}
