import fs from 'node:fs';
import path from 'node:path';
import {editorialSchema, editorialText} from '../../lib/news-editorial';
for (const id of process.argv.slice(2)) {
  const draft = JSON.parse(fs.readFileSync(path.join('research/news-backlog-2026-10-12/drafts', id + '.json'), 'utf8'));
  const result = editorialSchema.safeParse(draft.article);
  if (!result.success) { console.error(id, result.error.issues); process.exitCode = 1; }
  else console.log('VALID', id, editorialText(result.data.paragraphs).length);
}
