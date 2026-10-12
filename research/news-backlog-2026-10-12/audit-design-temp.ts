import fs from 'node:fs';
import path from 'node:path';
import { editorialSchema, editorialText } from '../../lib/news-editorial';
const base='research/news-backlog-2026-10-12';
const group=JSON.parse(fs.readFileSync(path.join(base,'design.json'),'utf8'));
const failures:any[]=[];
const lengths:number[]=[];
let drafts=0, exceptions=0;
for(const post of group){
  const file=path.join(base,'drafts',post.id+'.json');
  if(!fs.existsSync(file)){
    if(fs.existsSync(path.join(base,'exceptions',post.id+'.json'))) exceptions++;
    else failures.push({id:post.id,error:'missing draft or exception'});
    continue;
  }
  drafts++;
  const draft=JSON.parse(fs.readFileSync(file,'utf8'));
  const parsed=editorialSchema.safeParse(draft.article);
  if(!parsed.success){failures.push({id:post.id,error:parsed.error.issues});continue;}
  lengths.push(editorialText(parsed.data.paragraphs).length);
  if(draft.article.url!==post.content.source_url) failures.push({id:post.id,error:'original URL mismatch'});
  const primaryRefs=parsed.data.paragraphs.flatMap((s:any)=>s.references.filter((r:any)=>r.kind==='primary').map((r:any)=>r.url));
  const missing=primaryRefs.filter((url:string)=>!draft.research?.primarySourceUrls?.includes(url));
  if(missing.length) failures.push({id:post.id,error:'primary metadata missing',urls:missing});
  const expected=post.candidates.map((c:any)=>c.id);
  const missingCandidates=expected.filter((id:string)=>!draft.reviewedCandidateIds?.includes(id));
  if(missingCandidates.length) failures.push({id:post.id,error:'candidate review missing',ids:missingCandidates});
}
console.log(JSON.stringify({total:group.length,drafts,exceptions,minBody:Math.min(...lengths),maxBody:Math.max(...lengths),failures},null,2));
if(failures.length) process.exitCode=1;
