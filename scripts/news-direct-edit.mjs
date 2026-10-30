// Assemble reviewed, article-specific edits from the unchanged public snapshot.
import { editorialSchema, editorialText } from '../lib/news-editorial.ts';

export function directNewsEdit(before, edit) {
  const original = structuredClone(before.article_content.paragraphs);
  const clean = text => text.replace(/^ARCH\.B의 (?:해석으로는?|관점에서)\s*/, '').replace(/^ARCH\.B (?:분석|의견)[:：]\s*/, '');
  const sources = sections => [...new Map(sections.flatMap(s => s.references).map(r => [r.url, r])).values()];
  const compact = texts => {
    const result = texts.map(clean);
    while (result.length > 4) {
      const pairs = result.slice(1).map((text, i) => ({ i, length: result[i].length + text.length + 1 })).sort((a, b) => a.length - b.length);
      if (pairs[0].length > 1000) throw new Error('Opinion needs a direct paragraph edit');
      result.splice(pairs[0].i, 2, result[pairs[0].i] + ' ' + result[pairs[0].i + 1]);
    }
    return result;
  };
  const first = original[0];
  const introText = edit.intro || first.paragraphs.shift();
  const groups = (edit.groups || original.map((s, index) => ({ heading: s.heading.replace(/^ARCH\.B 분석[:：]\s*/, ''), sections: [index] })).filter(group => original[group.sections[0]].kind === 'reporting')).map(group => {
    const sections = group.sections.map(index => original[index]);
    return { heading: group.heading, kind: 'reporting', paragraphs: compact(sections.flatMap(s => s.paragraphs)), references: sources(sections) };
  }).filter(group => group.paragraphs.length);
  const opinions = (edit.opinionSections || original.flatMap((s, index) => s.kind === 'analysis' ? [index] : [])).map(index => original[index]);
  const article = editorialSchema.parse({ url: before.article_content.source_url, title: edit.title || before.title, summary: edit.summary || before.summary, points: before.article_content.points, tags: before.tags, paragraphs: [
    { heading: '', kind: 'reporting', paragraphs: [introText], references: first.references },
    ...groups,
    { heading: '', kind: 'reporting', paragraphs: [edit.recap], references: sources(original.filter(s => s.kind === 'reporting')).slice(0, 3) },
    { heading: 'ARCH.B 의견', kind: 'analysis', paragraphs: compact([...opinions.flatMap(s => s.paragraphs), ...(edit.opinion || [])]), references: sources(opinions.length ? opinions : original) },
  ] });
  if (!edit.removedUnsupportedInference && editorialText(article.paragraphs).length < editorialText(before.article_content.paragraphs).length) throw new Error('Direct editing must preserve the original detail');
  return { id: before.id, slug: before.slug, before: { title: before.title, summary: before.summary, content_hash: before.content_hash, protected_hash: before.protected_hash }, article, checkedAt: new Date().toISOString(), method: 'direct-editorial-review', editor: 'Codex' };
}
