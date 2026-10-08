// npx tsx scripts/check-news-duplicates.mjs — no external API calls or DB writes.
import assert from 'node:assert/strict';
import { duplicateUrl, duplicateCandidates, DuplicateNewsError } from '../lib/news-duplicates.ts';
import { checkNewsDuplicate, researchNews } from '../lib/news-research.ts';

const input = { url: 'https://example.com/new-agent', title: 'Figma launches the new canvas agent', source: 'Design Milk', publishedAt: '2026-10-06', sourceText: 'Figma has released a canvas agent for maintaining design systems.' };
const existing = { id: 'existing', slug: 'existing-slug', title: '피그마 에이전트 출시', original_title: 'Figma Agent becomes generally available', summary: '피그마 캔버스 에이전트의 디자인 시스템 자동화 기능 정식 출시.', source_url: 'https://figma.com/blog/agent-launch', source: 'Figma Blog', source_published_at: '2026-10-06', is_published: true };
assert.equal(duplicateUrl('https://www.example.com/en/articles/lynx/?utm_source=feed'), duplicateUrl('https://example.com/ko/articles/lynx'));
assert.notEqual(duplicateUrl('https://example.com/a?version=1'), duplicateUrl('https://example.com/a?version=2'), 'Semantic URL parameters remain distinct');
assert.deepEqual(duplicateCandidates(input, [existing]).map(candidate => candidate.id), ['existing'], 'Cross-publisher coverage joins the comparison');
const korean = { ...input, title: '새 디자인 도구의 출시와 실제 적용', source: existing.source };
assert.equal(duplicateCandidates(korean, [existing]).length, 1, 'A translation can be compared without shared title tokens');
assert.equal(duplicateCandidates({ ...korean, publishedAt: '2025-01-01' }, [existing]).length, 0, 'Old articles with only a shared publisher do not become candidates');

const fetchBefore = globalThis.fetch, keyBefore = process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY = 'test-only';
let requests = 0, assessment = { candidate_id: existing.id, confidence: 0.98, reason: '같은 피그마 캔버스 에이전트의 정식 출시를 두 매체가 보도했습니다.' };
globalThis.fetch = async (_url, options) => {
  requests++;
  const body = JSON.parse(options.body);
  assert.ok(body.systemInstruction.parts[0].text.includes('중복 기사 검토 담당자'), 'No investigation or draft request occurs for a held duplicate');
  assert.equal(body.tools, undefined, 'Duplicate comparison does not require a web search');
  assert.equal(JSON.parse(body.contents[0].parts[0].text).incoming.duplicateCandidates, undefined, 'Only the bounded comparison list is sent');
  return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(assessment) }] } }] });
};
try {
  await assert.rejects(researchNews({ ...input, category: 'design', duplicateCandidates: [existing] }), error => error instanceof DuplicateNewsError && error.matches[0].id === existing.id);
  assert.equal(requests, 1, 'A semantic duplicate is held before article generation');
  assessment = { candidate_id: 'none', confidence: 0, reason: '' };
  await checkNewsDuplicate({ ...input, title: 'Figma Agent 2: new pricing and a separate rollout' }, [existing], AbortSignal.timeout(1000));
  assessment = { candidate_id: existing.id, confidence: 0.6, reason: '공통 키워드만 있음' };
  await checkNewsDuplicate(input, [existing], AbortSignal.timeout(1000));
  assessment = { candidate_id: 'invented-id', confidence: 0.99, reason: 'Invalid comparison' };
  await assert.rejects(checkNewsDuplicate(input, [existing], AbortSignal.timeout(1000)), /대상이 일치하지/);
  const before = requests;
  await assert.rejects(checkNewsDuplicate({ ...input, url: 'https://www.figma.com/en/blog/agent-launch?utm_source=rss' }, [existing], AbortSignal.timeout(1000)), DuplicateNewsError);
  assert.equal(requests, before, 'An exact language-variant URL needs no AI call');
  await checkNewsDuplicate(input, [], AbortSignal.timeout(1000));
  assert.equal(requests, before, 'An empty shortlist needs no AI call');
} finally { globalThis.fetch = fetchBefore; if (keyBefore === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = keyBefore; }
console.log('Duplicate checks passed: language URLs, translated titles, cross-publisher comparison, distinct updates, low-confidence matches, response validation and bounded AI calls.');
