import assert from 'node:assert/strict';
import { activeClock, readingDepth, searchKeyword, campaign, analyticsTarget, analyticsDays, metricRate } from '../lib/engagement.ts';
import { dashboardPeriod } from '../lib/dashboard-metrics.ts';
import { randomUUID } from 'node:crypto';
import { writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';

assert.equal(readingDepth(900,1000,800),0);
assert.equal(readingDepth(200,1000,800),60);
assert.equal(readingDepth(-200,1000,800),100);
assert.equal(readingDepth(0,300,800),100);
assert.equal(readingDepth(0,0,800),null);
const clock=activeClock(0);
assert.equal(clock.tick(15000,true),15);
assert.equal(clock.tick(45000,true),30,'Idle time stops after 30 seconds');
assert.equal(clock.tick(75000,false),30,'Hidden tab time excluded');
assert.equal(clock.tick(76000,false,true),30);
assert.equal(clock.tick(86000,true),40,'Activity resumes reading');
assert.equal(clock.tick(85000,true),40,'Clock cannot subtract time');
assert.equal(searchKeyword('  모네   작품 '),'모네 작품');
for(const value of ['','name@example.com','https://private.test/?token=secret','010-1234-5678','password=secret']) assert.equal(searchKeyword(value),null,value);
assert.equal(searchKeyword('123abc'), '123abc');
assert.deepEqual(campaign('?utm_source=instagram&utm_medium=social&token=not-retained'),{source:'instagram',medium:'social'});
assert.deepEqual(campaign('?utm_source=alice@example.com'),{source:null,medium:null});
assert.equal(analyticsTarget('https://example.com/story?private=secret#part'),'https://example.com/story');
assert.equal(analyticsTarget('/art/work'),'/art/work');
for(const path of ['/dashboard','/login','//private.test','/art/work?token=private','javascript:alert(1)','https://a:b@example.com/','https://127.0.0.1/','https://example.com/a%40b']) assert.equal(analyticsTarget(path),null,path);
assert.equal(metricRate(0,0),'—');
assert.equal(analyticsDays('90'),90);
assert.equal(analyticsDays('invalid'),7);
const period=dashboardPeriod(90,new Date('2026-10-23T05:00:00Z'));
assert.equal(period.dates.length,90);
assert.equal(period.dates[0],'2026-07-26');
assert.equal(period.previousEnd,'2026-07-25T05:00:00.000Z');

const base=process.argv.find(value=>value.startsWith('http'));
if(base){
  const input={id:randomUUID(),viewId:randomUUID(),kind:'engagement',activeSeconds:30,depth:80};
  const headers={'Content-Type':'application/json',Origin:new URL(base).origin,'User-Agent':'Mozilla/5.0 ARCHB-QA'};
  const post=(body,extra={})=>fetch(new URL('/api/analytics/events',base),{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
  assert.equal((await post(input,{Origin:'https://foreign.test'})).status,403);
  for(const extra of [{DNT:'1'},{'Sec-GPC':'1'},{'User-Agent':'Googlebot'}])assert.equal((await post(input,extra)).status,204);
  for(const path of ['/dashboard/analytics','/dashboard/analytics/content','/dashboard/analytics/search']){
    const res=await fetch(new URL(path,base),{redirect:'manual'});
    assert.equal(res.status,307,`Anonymous analysis route: ${path}`);
  }
  if(process.argv.includes('--live-write')){
    const {createClient}=await import('@supabase/supabase-js');
    const {createServerClient}=await import('@supabase/ssr');
    assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,'overgjynkrnwayfammid.supabase.co');
    const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
    const ids=[randomUUID(),randomUUID()], searchId=randomUUID(); let userId;
    try{
      const initial=await fetch(new URL('/api/analytics/pageview',base),{method:'POST',headers,body:JSON.stringify({id:ids[0],path:'/art/bowes-bm-99',campaign:'?utm_source=analytics-qa&utm_medium=test&private=discard'})});
      assert.equal(initial.status,204);
      const cookie=initial.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
      assert.ok(cookie.includes('archb_visitor='));
      const original=await db.from('site_page_views').select('*').eq('id',ids[0]).single();
      assert.equal(original.error,null);assert.equal(original.data.campaign_source,'analytics-qa');assert.equal(original.data.campaign_medium,'test');
      const fixture={...original.data,id:ids[1],path:'/search',section:'검색',is_entry:false,created_at:new Date(Date.now()-120000).toISOString(),campaign_source:null,campaign_medium:null};
      assert.equal((await db.from('site_page_views').insert(fixture)).error,null);
      const event=(data,extra={})=>post({...input,viewId:ids[1],id:randomUUID(),...data},{Cookie:cookie,...extra});
      assert.equal((await event({activeSeconds:45,depth:90})).status,204);
      assert.equal((await event({activeSeconds:5,depth:10})).status,204);
      const measured=await db.from('site_page_views').select('active_seconds,scroll_depth').eq('id',ids[1]).single();
      assert.deepEqual(measured.data,{active_seconds:45,scroll_depth:90});
      assert.equal((await event({activeSeconds:-1})).status,400);
      assert.equal((await event({activeSeconds:7201})).status,400);
      assert.equal((await event({depth:101})).status,400);
      assert.equal((await event({kind:'search',query:'analytics QA 없는 검색',results:0,searchId})).status,204);
      assert.equal((await event({kind:'search',query:'analytics QA 없는 검색',results:0,searchId})).status,204);
      assert.equal((await event({kind:'search',query:'name@example.com',results:0,searchId:randomUUID()})).status,400);
      assert.equal((await event({kind:'save',target:'/art/bowes-bm-99'})).status,204);
      assert.equal((await event({kind:'save',target:'/art/bowes-bm-99'})).status,204);
      const stored=await db.from('site_analytics_events').select('kind,query,target').eq('page_view_id',ids[1]);
      assert.equal(stored.error,null);assert.equal(stored.data.length,2);
      assert.equal((await post({...input,id:randomUUID(),viewId:ids[1],activeSeconds:999,depth:100},{Cookie:`archb_visitor=${randomUUID()}`})).status,204);
      assert.equal((await db.from('site_page_views').select('active_seconds').eq('id',ids[1]).single()).data.active_seconds,45,'Other visitor cannot alter progress');
      const anon=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
      assert.ok((await anon.from('site_analytics_events').select('*')).error);
      assert.ok((await anon.rpc('site_engagement_stats',{p_start:new Date(Date.now()-86400000).toISOString(),p_end:new Date().toISOString(),p_previous_start:new Date(Date.now()-172800000).toISOString(),p_previous_end:new Date(Date.now()-86400000).toISOString()})).error);
      const email=`archb-analytics-qa-${randomUUID()}@example.com`,password=randomUUID()+randomUUID();
      const created=await db.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null);userId=created.data.user.id;
      let cookies=[];
      const auth=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>cookies,setAll:values=>{for(const value of values){cookies=cookies.filter(item=>item.name!==value.name);cookies.push(value);}}}});
      const login=await auth.auth.signInWithPassword({email,password});assert.equal(login.error,null);
      const authCookie=cookies.map(value=>`${value.name}=${value.value}`).join('; ');
      for(const role of ['user','editor','sub-admin','admin']){
        assert.equal((await db.from('users').update({role}).eq('id',userId)).error,null);
        for(const path of ['/dashboard/analytics','/dashboard/analytics/content','/dashboard/analytics/search','/dashboard/analytics/visitors?days=90']){
          const res=await fetch(new URL(path,base),{headers:{Cookie:authCookie},redirect:'manual'});
          assert.equal(res.status,['admin','sub-admin'].includes(role)?200:307,`${role}: ${path}`);
          if(res.status===200){const html=await res.text();assert.ok(html.includes('통계 분석 메뉴'));assert.equal(html.includes('읽기·검색 분석을 불러오지 못했습니다'),false);}
        }
        console.log(`Verified analytics access and rendering: ${role}`);
      }
      const excludedId=randomUUID();
      assert.equal((await fetch(new URL('/api/analytics/pageview',base),{method:'POST',headers:{...headers,Cookie:authCookie},body:JSON.stringify({id:excludedId,path:'/art'})})).status,204);
      assert.equal((await db.from('site_page_views').select('id').eq('id',excludedId)).data.length,0,'Operator public visits excluded');
      if(process.argv.includes('--snapshot')){
        assert.equal((await db.from('site_page_views').delete().in('id',ids)).error,null);
        await mkdir('.next-analytics-preview/qa',{recursive:true});
        const route=`/qa/${randomUUID()}`;
        // Test-only loopback bootstrap keeps QA credentials out of URLs and the production app.
        const bootstrap=createServer((request,response)=>{
          if(request.url!==route){response.writeHead(404);response.end();return;}
          response.setHeader('Set-Cookie',cookies.map(c=>`${c.name}=${c.value}; Path=/; Max-Age=300; SameSite=Lax`));
          response.writeHead(302,{Location:`${base}/dashboard/analytics`});response.end();
        });
        await new Promise((resolve,reject)=>{bootstrap.once('error',reject);bootstrap.listen(0,'127.0.0.1',resolve);});
        await writeFile('.next-analytics-preview/qa/session.json',JSON.stringify({url:`http://localhost:${bootstrap.address().port}${route}`}));
        console.log('Temporary QA session ready for browser verification; expires automatically in 5 minutes.');
        const until=Date.now()+300000;
        while(Date.now()<until){try{await readFile('.next-analytics-preview/qa/done');break;}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}
        await new Promise(resolve=>bootstrap.close(resolve));
        await rm('.next-analytics-preview/qa/session.json',{force:true});await rm('.next-analytics-preview/qa/done',{force:true});
      }
    }finally{
      assert.equal((await db.from('site_page_views').delete().in('id',ids)).error,null);
      if(userId)assert.equal((await db.auth.admin.deleteUser(userId)).error,null);
    }
    console.log('Live API, private metrics, operator exclusion and role checks passed; temporary records removed.');
  }
}
console.log('Engagement checks passed: active reading, idle/hidden time, body depth, safe search/campaigns, targets, 90-day periods and access control.');
