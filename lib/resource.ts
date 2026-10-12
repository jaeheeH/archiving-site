export const RESOURCE_LABELS = { post: '기사', artwork: '작품', artist: '작가', reference: '참고사이트', gallery: '갤러리' } as const;
export type ResourceType = keyof typeof RESOURCE_LABELS;
export type Resource = {
  type: ResourceType; id: string; title: string; description: string; url: string;
  image: string | null; source: string; tags: string[]; searchText: string; date?: string;
};
export function resourceType(input?: string | string[]): ResourceType | 'all' {
  const value = queryText(input);
  return value && Object.hasOwn(RESOURCE_LABELS, value) ? value as ResourceType : 'all';
}
import { queryText } from './search-text';
