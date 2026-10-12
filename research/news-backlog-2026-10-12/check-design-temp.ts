import fs from 'node:fs';
import assert from 'node:assert/strict';
import { editorialSchema, editorialText } from '../../lib/news-editorial';
const ids = ['5103be29-fb9c-470c-a4a0-65b5cbb4c88a','990773d6-6953-49b5-9165-1a68011a1e75','812b1579-ce10-4d05-8a83-76da5cc2a422','36f1c089-cd46-4b94-9955-7638bc6c99c2'];
const group = JSON.parse(fs.readFileSync('research/news-backlog-2026-10-12/design.json','utf8'));
for (const id of ids) {
  const d = JSON.parse(fs.readFileSync(`research/news-backlog-2026-10-12/drafts/${id}.json`,'utf8'));
  const parsed = editorialSchema.safeParse(d.article);
  assert(parsed.success, `${id}: ${JSON.stringify(parsed.success ? [] : parsed.error.issues)}`);
  assert.deepEqual(d.reviewedCandidateIds, group.find((p:any) => p.id === id).candidates.map((p:any) => p.id));
  assert.equal(d.research.model,'codex-direct');
  assert(d.research.primarySourceUrls.length > 0);
  assert.equal(d.review.approved,true);
  console.log(id, editorialText(d.article.paragraphs).length, 'PASS');
}
