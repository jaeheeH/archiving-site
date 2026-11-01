import type { JSONContent } from '@tiptap/core';
type TiptapContent = JSONContent | JSONContent[] | string | null;
export interface ArticleHeading {
  id: string;
  level: number;
  text: string;
}

export const getNodeText = (node: TiptapContent): string => {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.content)) return '';
  return node.content.map(getNodeText).join('');
};

const createHeadingId = (text: string, index: number) => {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);

  return slug || `section-${index + 1}`;
};

export const renderedHeadingLevel = (value: unknown) => Math.max(2, Math.min(6, Math.trunc(Number(value)) || 2));

export function createHeadingResolver() {
  const seenIds = new Set<string>();
  let index = 0;
  return (node: JSONContent): ArticleHeading | undefined => {
    if (node.type !== 'heading') return;
    const level = renderedHeadingLevel(node.attrs?.level);
    const text = getNodeText(node).trim();
    if (level > 3 || !text) return;
    const baseId = createHeadingId(text, index++);
    let id = baseId;
    let suffix = 1;
    while (seenIds.has(id)) id = `${baseId}-${++suffix}`;
    seenIds.add(id);
    return { id, level, text };
  };
}

export const extractHeadings = (content: TiptapContent): ArticleHeading[] => {
  const headings: ArticleHeading[] = [];
  const resolveHeading = createHeadingResolver();

  const visit = (node: TiptapContent) => {
    if (!node) return;
    if (typeof node === 'string') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const heading = resolveHeading(node);
    if (heading) headings.push(heading);

    if (Array.isArray(node.content)) {
      node.content.forEach(visit);
    }
  };

  visit(content);
  return headings;
};

