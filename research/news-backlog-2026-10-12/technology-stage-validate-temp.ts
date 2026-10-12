import fs from 'node:fs';
import path from 'node:path';
import {editorialSchema, editorialText} from '../../lib/news-editorial';
const base='research/news-backlog-2026-10-12';
for(const id of process.argv.slice(2)) {
  const staged=path.join(base,'technology-staged',id+'.json');
  const final=path.join(base,'drafts',id+'.json');
  if(fs.existsSync(final)) { console.log('EXISTS',id); continue; }
  const d=JSON.parse(fs.readFileSync(staged,'utf8'));
  const result=editorialSchema.safeParse(d.article);
  if(!result.success) { console.error(id,result.error.issues); process.exitCode=1; continue; }
  fs.renameSync(staged,final);
  console.log('VALID SAVED',id,editorialText(result.data.paragraphs).length);
}
