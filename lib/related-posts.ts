type RelatedPost = {
  id: string;
  tags?: string[] | null;
  category_id?: string | null;
  content?: unknown;
  title?: string | null;
  subtitle?: string | null;
  summary?: string | null;
  published_at?: string | null;
};

const tagKey = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('ko');

/** Recent posts break relevance ties; recency alone is never a recommendation. */
export function relatedPosts<T extends RelatedPost>(current: RelatedPost, candidates: T[], contentCategory?: string | null) {
  const tags = new Set((current.tags || []).map(tagKey).filter(tag => tag && !/^arch[.\-\s]?b(?:\s*시선)?$/i.test(tag)));
  const score = (item: T) => {
    const overlap = new Set((item.tags || []).map(tagKey).filter(tag => tags.has(tag))).size;
    const text = tagKey([item.title, item.subtitle, item.summary, ...(item.tags || [])].filter(Boolean).join(' '));
    const mentions = [...tags].filter(tag => tag.length >= 2 && (/^[a-z0-9 ]+$/i.test(tag)
      ? ` ${text.replace(/[^a-z0-9 ]/g, ' ')} `.includes(` ${tag} `)
      : text.includes(tag))).length;
    const categoryMatch = !!((contentCategory && item.content === contentCategory)
      || (current.category_id && item.category_id === current.category_id));
    // Old imports can put unrelated subjects in the same category. When topic
    // tags exist, the candidate must support them in its tags or visible copy.
    if (tags.size && !overlap && !mentions) return 0;
    return overlap * 10 + mentions * 4 + (categoryMatch ? 3 : 0);
  };
  const published = (item: T) => Date.parse(item.published_at || '') || 0;
  return [...new Map(candidates.filter(item => item.id !== current.id).map(item => [item.id, item])).values()]
    .map(item => ({ item, score: score(item) }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || published(b.item) - published(a.item) || a.item.id.localeCompare(b.item.id))
    .slice(0, 3).map(candidate => candidate.item);
}
