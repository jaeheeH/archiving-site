import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
const base=process.argv[2];
assert(base && ['localhost','127.0.0.1'].includes(new URL(base).hostname));
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname,'overgjynkrnwayfammid.supabase.co');
const db=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const accounts=[];
let publishedFixture,headersA;
async function account() {
  const email=`archb-search-qa-${randomUUID()}@example.com`,password=randomUUID()+randomUUID();
  const created=await db.auth.admin.createUser({email,password,email_confirm:true});
  assert.equal(created.error,null); const id=created.data.user.id;accounts.push(id);
  let cookies=[];
  const auth=createServerClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>cookies,setAll:values=>{cookies=values;}}});
  assert.equal((await auth.auth.signInWithPassword({email,password})).error,null);
  return {id,auth,headers:{'Content-Type':'application/json',Cookie:cookies.map(c=>`${c.name}=${c.value}`).join('; '),Origin:new URL(base).origin}};
}
const call=(headers,path,method='GET',body)=>fetch(new URL(path,base),{method,headers,...(body===undefined ? {}:{body:JSON.stringify(body)})});
try {
  const a=await account(),b=await account();headersA=a.headers;
  const works=await db.from('artworks').select('id').limit(1);
  const artists=await db.from('artists').select('id').limit(1);
  const gallery=await db.from('gallery').select('id').limit(1);
  const references=await db.from('references').select('id').limit(1);
  const posts=await db.from('published_post_summaries').select('id').order('id').limit(85);
  assert.equal(posts.error,null);assert.equal(posts.data.length,85);
  const endpoints=[['artwork','artworks',works.data[0].id],['artist','artists',artists.data[0].id],['gallery','gallery',gallery.data[0].id],['reference','references',references.data[0].id],['post','posts',posts.data[0].id]];
  for (const [kind,segment,id] of endpoints) {
    const path=`/api/${segment}/${id}/scrap`;
    assert.equal((await fetch(new URL(path,base),{method:'PUT',headers:{'Content-Type':'application/json'},body:'{"scraped":true}'})).status,401);
    assert.equal((await call(a.headers,path,'PUT',{scraped:'yes'})).status,400);
    assert.equal((await call({...a.headers,Origin:'https://foreign.example'},path,'PUT',{scraped:true})).status,403);
    const repeated=await Promise.all([call(a.headers,path,'PUT',{scraped:true}),call(a.headers,path,'PUT',{scraped:true})]);
    for (const res of repeated) {assert.equal(res.status,200);assert.equal((await res.json()).scraped,true);}
    const key=`${kind}:${id}`;
    assert.ok((await (await call(a.headers,'/api/saved')).json()).keys.includes(key));
    assert.ok(!(await (await call(b.headers,'/api/saved')).json()).keys.includes(key));
  }
  for (const table of ['post_scraps','gallery_scraps','reference_scraps','artwork_scraps','artist_scraps']) {
    const other=await b.auth.from(table).select('user_id').eq('user_id',a.id);
    assert.equal(other.error,null);assert.deepEqual(other.data,[],'Another account cannot read saved rows');
  }
  const anon=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
  for (const table of ['gallery_scraps','reference_scraps']) { const hidden=await anon.from(table).select('user_id');assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[]); }
  assert.ok((await b.auth.from('artwork_scraps').insert({user_id:a.id,artwork_id:works.data[0].id})).error);
  const inserted=await db.from('post_scraps').upsert(posts.data.map(p=>({post_id:p.id,user_id:a.id})),{onConflict:'post_id,user_id',ignoreDuplicates:true});assert.equal(inserted.error,null);
  const page=await call(a.headers,'/mypage/activity?type=post&page=4');assert.equal(page.status,200);
  assert.equal(((await page.text()).match(/class="resource-card"/g)||[]).length,13,'Items beyond the former 80-item cap remain available');
  const initial=await (await call(a.headers,'/mypage/activity?type=post')).text();assert.equal((initial.match(/class="resource-card"/g)||[]).length,24);
  const search=await (await fetch(new URL('/search?q=모네&type=artwork',base))).text();assert.equal((search.match(/class="resource-card"/g)||[]).length,3);assert.match(search,/수련/);assert.match(search,/붉은 스카프/);assert.match(search,/모네 가족/);
  assert.equal(((await (await fetch(new URL('/art?q=모네',base))).text()).match(/<article class="archive-card archive-art-card group"/g)||[]).length,3);
  assert.equal((await call(a.headers,'/api/curations/draft','POST',{topic:'빛과 공간'})).status,403);
  await db.from('users').update({role:'admin'}).eq('id',a.id);
  assert.equal((await call(a.headers,'/api/curations/draft','POST',{topic:'x'.repeat(101)})).status,400);
  assert.equal((await call(a.headers,'/api/curations/draft','POST',{retryId:randomUUID()})).status,409);
  const category=await db.from('categories').select('id').eq('slug','curation').eq('type','blog').single();assert.equal(category.error,null);
  const id=randomUUID(),slug=`archb-cache-qa-${id}`;
  const fixture=await db.from('posts').insert({id,slug,type:'blog',author_id:a.id,title:'ARCH.B 임시 캐시 검증 자료',summary:'검색과 큐레이션의 발행 상태를 확인하는 임시 검증 자료입니다.',tags:['ARCHB_QA'],is_published:false,category_id:category.data.id,content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'임시 검증 자료입니다.'}]}]}});
  assert.equal(fixture.error,null);publishedFixture=id;
  assert.equal((await fetch(new URL(`/news/read/${slug}`,base))).status,404);
  assert.equal((await call(a.headers,`/api/posts/${id}/publish`,'PATCH',{is_published:true})).status,200);
  assert.ok((await (await fetch(new URL('/sitemap.xml',base))).text()).includes(slug));
  assert.ok((await (await fetch(new URL('/',base))).text()).includes('주제로 이어보기'));
  assert.equal((await (await fetch(new URL('/api/news?view=list&q=ARCHB_QA',base))).json()).articles.length,1);
  assert.equal((await call(a.headers,`/api/posts/${id}`,'PUT',{type:'blog',slug,title:'ARCH.B 수정된 임시 검증 자료',summary:'캐시 수정 후 공개 검색에서도 변경된 제목을 확인합니다.',tags:['ARCHB_QA'],content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'수정된 임시 검증 자료입니다.'}]}]}})).status,200);
  const changed=await (await fetch(new URL('/search?q=ARCHB_QA&type=post',base))).text();assert.match(changed,/수정된 임시 검증 자료/);
  assert.equal((await call(a.headers,`/api/posts/${id}/publish`,'PATCH',{is_published:false})).status,200);
  assert.ok(!(await (await fetch(new URL('/sitemap.xml',base))).text()).includes(slug));
  assert.equal((await (await fetch(new URL('/api/news?view=list&q=ARCHB_QA',base))).json()).articles.length,0);
  assert.equal((await call(a.headers,`/api/posts/${posts.data[0].id}/scrap`,'PUT',{scraped:false})).status,200);
  assert.equal((await call(a.headers,`/api/posts/${posts.data[0].id}/scrap`,'POST')).status,200,'Old toggle clients keep working');
  console.log('Live search/save checks passed: all five types, repeated PUT, 85 saved articles, 24-item pages, own/anonymous RLS, role restrictions, publish/edit/unpublish and sitemap/cache invalidation.');
} finally {
  if (publishedFixture && headersA) {
    await call(headersA,`/api/posts/${publishedFixture}/publish`,'PATCH',{is_published:false});
    const removed=await call(headersA,`/api/posts/${publishedFixture}`,'DELETE');
    if (!removed.ok) await db.from('posts').delete().eq('id',publishedFixture);
  }
  for (const id of accounts) { await db.auth.admin.deleteUser(id);await db.from('users').delete().eq('id',id); }
  console.log('Temporary QA accounts and their private saves were removed.');
}
