// Run: node scripts/check-news-thumbnails.mjs. Mocked requests only; no live data changes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as zod from 'zod';
import * as crypto from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const id='11111111-1111-4111-8111-111111111111';
const image=`https://overgjynkrnwayfammid.supabase.co/storage/v1/object/public/posts/news-thumbnails/${id}/image.webp`;
const paragraph='이 문장은 뉴스 썸네일 기능을 검증하기 위한 가상 기사 본문입니다. 원출처와 본문을 보존하고 별도 이미지만 연결하는 동작을 확인합니다. '.repeat(7).trim();
const article={url:'https://primary.example/news',title:'별도 뉴스 썸네일 검증용 가상 기사',summary:'원본 이미지가 없는 경우에만 별도 썸네일을 목록에 사용하고 기사 본문과 발행 상태를 보존하는지 검증합니다.',tags:['테스트'],points:['원본 이미지가 있으면 기존 방식을 우선합니다.','별도 썸네일은 상세 본문에 표시하지 않습니다.'],paragraphs:Array.from({length:4},(_,i)=>({heading:`검증용 섹션 ${i+1}`,kind:i===3?'analysis':'reporting',paragraphs:[paragraph],references:i===0?[{label:'공식 원출처',kind:'primary',url:'https://primary.example/news'},{label:'추가 근거 자료',kind:'primary',url:'https://primary.example/details'}]:[]}))};
let post,allowed,failed,concurrent,updates,invalidations,requested;
function reset(){
  post={id,type:'news',slug:'test-news',title:article.title,summary:article.summary,tags:article.tags,title_image_url:'https://original.example/photo.jpg',thumbnail_url:image,author_id:'owner',is_published:true,published_at:'2026-10-15T00:00:00Z',updated_at:'2026-10-16T00:00:00Z',content:{format:'archb-news-v1',source_url:article.url,source:'Original publisher',source_published_at:'2026-10-14T00:00:00Z',original_title:'Original title',category:'design',paragraphs:article.paragraphs,points:article.points,thumbnail_credit:'이전 이미지 출처',thumbnail_provenance:{sha256:'old'},title_image_credit:'원본 사진 제공처'}};
  allowed=true;failed=false;concurrent=false;updates=0;invalidations=[];requested=[];
}
const db=createClient('https://test.supabase.co','test-key',{auth:{persistSession:false},global:{fetch:async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url);
  requested.push(options.method||'GET');
  if(options.method==='PATCH'){
    updates++;
    assert.equal(url.searchParams.get('updated_at'),`eq.${post.updated_at}`);
    if(failed)return Response.json({message:'Test database failure'},{status:503});
    if(concurrent)return Response.json(null);
    const change=JSON.parse(options.body);
    assert(!('title_image_url' in change),'Thumbnail editing cannot replace the original image.');
    post={...post,...change};return Response.json({id});
  }
  return Response.json(post);
}}});
const mocks={
  zod,'node:crypto':crypto,'server-only':{},
  'next/cache':{unstable_cache:fn=>fn,revalidateTag:tag=>invalidations.push(tag),revalidatePath:path=>invalidations.push(path)},
  '@/lib/public-data':{CACHE_TAGS:{posts:'public-posts',home:'public-home'}},
  '@/lib/supabase/admin':{createAdminClient:()=>db},
  '@/lib/supabase/public':{createPublicClient:()=>db},
  '@/lib/supabase/post-utils':{checkPostOwnershipOrAdmin:async()=>allowed?{authorized:true,userId:'owner',role:'admin'}:{authorized:false,error:Response.json({error:'Forbidden'},{status:403})}},
  './supabase/post-utils':{},'./news-feeds':{FEEDS:[],CATEGORIES:{design:'디자인'}},
};
function load(path){
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,console,URL,Response,require:name=>{assert(name in mocks,`Unexpected import: ${name}`);return mocks[name];}});
  return exports;
}
const editorial=load('../lib/news-editorial.ts');
mocks['./news-editorial']=mocks['@/lib/news-editorial']=editorial;
const record=load('../lib/news-record.ts');mocks['./news-record']=mocks['@/lib/news-record']=record;
const {mapPublishedRows}=load('../lib/news.ts');
const {PATCH}=load('../app/api/news/[id]/route.ts');
assert(editorial.editorialSchema.safeParse(article).success,'Use a valid publishable fixture.');
const payload={article,is_published:true};
const call=(extra={},headers={})=>PATCH(new Request(`https://archbehind.com/api/news/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({...payload,...extra})}),{params:Promise.resolve({id})});

reset();assert.equal(mapPublishedRows([post])[0].image,post.title_image_url);
reset();post.title_image_url=null;assert.equal(mapPublishedRows([post])[0].image,image);assert.equal(post.title_image_url,null,'List mapping must not turn the fallback into a detail image.');
reset();post.title_image_url=post.thumbnail_url=null;assert.equal(mapPublishedRows([post])[0].image,null);
reset();post.type='blog';post.title_image_url=null;assert.equal(mapPublishedRows([post])[0].image,null,'Existing editorial image behavior is unchanged.');

reset();allowed=false;assert.equal((await call({thumbnail_url:image})).status,403);assert.equal(updates,0);
for(const bad of ['https://other-project.supabase.co/storage/v1/object/public/posts/a.webp','https://example.com/image.jpg','javascript:alert(1)','https://overgjynkrnwayfammid.supabase.co/storage/v1/object/public/avatars/a.webp','https://user@overgjynkrnwayfammid.supabase.co/storage/v1/object/public/posts/a.webp']){
  reset();assert.equal((await call({thumbnail_url:bad})).status,400);assert.equal(updates,0);
}
reset();assert.equal((await call({title_image_url:image})).status,400);assert.equal(updates,0);
reset();assert.equal((await call({thumbnail_credit:'x'.repeat(201)})).status,400);assert.equal(updates,0);
reset();assert.equal((await call({thumbnail_url:image},{Origin:'https://foreign.example'})).status,403);assert.equal(updates,0);
reset();assert.equal((await call()).status,200);assert.equal(post.thumbnail_url,image);assert.equal(post.content.thumbnail_credit,'이전 이미지 출처');assert.equal(post.content.thumbnail_provenance.sha256,'old');
reset();const original=structuredClone(post);const replacement=image.replace('image.webp','new.webp');
assert.equal((await call({thumbnail_url:replacement,thumbnail_credit:'ARCH.B · AI 생성'})).status,200);
assert.equal(post.thumbnail_url,replacement);assert.equal(post.content.thumbnail_credit,'ARCH.B · AI 생성');assert.equal(post.content.thumbnail_provenance,undefined);
for(const field of ['title','summary','title_image_url','published_at','is_published','author_id'])assert.deepEqual(post[field],original[field],field);
for(const field of ['paragraphs','points','source','source_url','source_published_at','original_title','title_image_credit'])assert.deepEqual(post.content[field],original.content[field],field);
for(const key of ['archb-news','public-posts','public-home','/','/news/stories','/rss.xml','/sitemap.xml','/news/read/test-news'])assert(invalidations.includes(key),key);
assert(requested.every(method=>method==='GET'||method==='PATCH'),'Removing a thumbnail must not delete stored image files.');
reset();assert.equal((await call({thumbnail_url:null,thumbnail_credit:''})).status,200);assert.equal(post.thumbnail_url,null);assert.equal(post.content.thumbnail_credit,undefined);assert.equal(post.title_image_url,'https://original.example/photo.jpg');
reset();concurrent=true;assert.equal((await call({thumbnail_url:replacement})).status,409);assert.equal(post.thumbnail_url,image);assert.equal(invalidations.length,0);
reset();failed=true;assert.equal((await call({thumbnail_url:replacement})).status,503);assert.equal(post.thumbnail_url,image);assert.equal(invalidations.length,0);

console.log('News thumbnail checks passed: original priority, separate list fallback, legacy requests, upload URL validation, ownership, credit, removal, concurrent edits, failure preservation and cache invalidation. No live data changed.');
