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

export const extractHeadings = (content: TiptapContent): ArticleHeading[] => {
  const headings: ArticleHeading[] = [];
  const seenIds = new Map<string, number>();

  const visit = (node: TiptapContent) => {
    if (!node) return;
    if (typeof node === 'string') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.type === 'heading' && [2, 3].includes(node.attrs?.level)) {
      const text = getNodeText(node).trim();
      if (text) {
        const baseId = createHeadingId(text, headings.length);
        const seenCount = seenIds.get(baseId) || 0;
        seenIds.set(baseId, seenCount + 1);

        headings.push({
          id: seenCount > 0 ? `${baseId}-${seenCount + 1}` : baseId,
          level: Number(node.attrs?.level || 2),
          text,
        });
      }
    }

    if (Array.isArray(node.content)) {
      node.content.forEach(visit);
    }
  };

  visit(content);
  return headings;
};

