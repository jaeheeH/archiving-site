const fs = require('node:fs');
const path = require('node:path');
const base = __dirname;
const posts = JSON.parse(fs.readFileSync(path.join(base, 'technology.json'), 'utf8'));
module.exports = function draft(id,title,summary,sources,sections,points,tags,notes,checks) {
  const post = posts.find(p => p.id === id);
  const item = {id,article:{url:post.content.source_url,title,summary,paragraphs:sections.map(([heading,kind,paragraphs,refs])=>({heading,kind,paragraphs,references:refs.map(i=>({...sources[i],kind:'primary'}))})),points,tags},research:{model:'codex-direct',sources,primarySourceUrls:sources.map(s=>s.url),notes,queries:[],searchSuggestions:''},reviewedCandidateIds:post.candidates.map(p=>p.id),review:{approved:true,checkedAt:new Date().toISOString(),checks,relatedPendingIds:[]}};
  const target = path.join(base,'drafts',id+'.json');
  const staged = path.join(base,'technology-staged',id+'.json');
  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(staged),{recursive:true});
    fs.writeFileSync(staged,JSON.stringify(item,null,2)+'\n');
  }
  console.log(id,item.article.paragraphs.flatMap(s=>s.paragraphs).join(' ').length);
};
