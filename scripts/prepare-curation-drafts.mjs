import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
const base=process.argv[2],authorId=process.argv[3];
assert(base && ['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert.match(authorId || '',/^[a-f0-9-]{36}$/);
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname,'overgjynkrnwayfammid.supabase.co');
const db=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const author=await db.from('users').select('role').eq('id',authorId).single();assert.equal(author.error,null);assert.ok(['admin','sub-admin','editor'].includes(author.data.role));
let account;const drafts=[];
try {
  const email=`archb-curation-run-${randomUUID()}@example.com`,password=randomUUID()+randomUUID();
  const created=await db.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null);account=created.data.user.id;
  assert.equal((await db.from('users').update({role:'admin'}).eq('id',account)).error,null);
  let cookies=[];
  const auth=createServerClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>cookies,setAll:value=>{cookies=value;}}});
  assert.equal((await auth.auth.signInWithPassword({email,password})).error,null);
  const headers={'Content-Type':'application/json',Cookie:cookies.map(c=>`${c.name}=${c.value}`).join('; '),Origin:new URL(base).origin};
  const request=(method='GET',body)=>fetch(new URL('/api/curations/draft',base),{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
  for (const topic of (process.argv[4] ? [process.argv[4]] : ['빛과 공간','만드는 사람의 AI 도구'])) {
    const submitted=await request('POST',{topic});const result=await submitted.json();assert.equal(submitted.status,202,result.error);
    let previous='',done=false;
    for(let attempt=0;attempt<40;attempt++) {
      const response=await request();const state=await response.json();assert.equal(response.status,200,state.error);
      const job=state.job;assert.equal(job.id,result.job.id);
      if(job.status!==previous) {console.log(JSON.stringify({topic,status:job.status}));previous=job.status;}
      if(job.status==='failed') throw Error(job.error);
      if(job.status==='completed') {
        const saved=await db.from('posts').select('id,title,is_published,author_id,content').eq('id',job.draftId).single();assert.equal(saved.error,null);assert.equal(saved.data.is_published,false);assert.equal(saved.data.author_id,account);
        assert.equal(saved.data.content.content.filter(n=>n.type==='heading').length,6);
        const assigned=await db.from('posts').update({author_id:authorId}).eq('id',job.draftId).eq('author_id',account).eq('is_published',false);assert.equal(assigned.error,null);
        drafts.push({id:job.draftId,title:saved.data.title,review:`${base}/dashboard/contents/blog/${job.draftId}/edit`});done=true;break;
      }
      await new Promise(resolve=>setTimeout(resolve,15000));
    }
    assert.ok(done,'Curation generation timed out');
  }
  console.log(JSON.stringify({drafts}));
} finally {
  if(account) {
    // Retain completed unpublished drafts even if a later topic fails.
    await db.from('posts').update({author_id:authorId}).eq('author_id',account).eq('type','blog').eq('is_published',false);
    await db.auth.admin.deleteUser(account);await db.from('users').delete().eq('id',account);
  }
  console.log('Curation setup account removed; no automatic publication.');
}
