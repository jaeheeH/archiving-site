import assert from 'node:assert/strict';
import { buildDashboardMetrics, dashboardPeriod, kstDate, periodChange } from '../lib/dashboard-metrics.ts';

const now = new Date('2026-10-07T05:30:00Z');
assert.equal(kstDate('2026-10-06T15:00:00Z'), '2026-10-07');
assert.equal(kstDate('invalid'), '');
assert.equal(dashboardPeriod(999, now).days, 7);
assert.deepEqual(dashboardPeriod(5, now).dates, ['2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07']);
assert.equal(dashboardPeriod(30, new Date('2026-01-01T00:00:00Z')).dates[0], '2025-12-03');
const post = { id:'news', type:'news', title:'기사', slug:'news', is_published:true, created_at:'2026-10-07T01:00:00Z', published_at:'2026-10-06T15:00:00Z', view_count:12, scrap_count:2, like_count:1, category:'design', qualityReady:false };
const draft = {...post,id:'draft',is_published:false,created_at:'2026-09-20T00:00:00Z',view_count:100,qualityReady:undefined};
const editorial = {...post,id:'blog',type:'blog',qualityReady:undefined,created_at:'2026-09-01T00:00:00Z',published_at:'2026-09-30T01:00:00Z'};
const views = [
  {post_id:'news',created_at:'2026-10-07T03:00:00Z'},
  {post_id:'blog',created_at:'2026-10-01T01:00:00Z'},
  {post_id:'draft',created_at:'2026-10-07T04:00:00Z'},
  {post_id:'another-author',created_at:'2026-10-07T04:00:00Z'},
  {post_id:'news',created_at:'2026-10-07T06:00:00Z'}, // Future records cannot inflate the current period.
];
const metrics=buildDashboardMetrics([post,draft,editorial],views,[{role:'admin',created_at:'2026-09-01T00:00:00Z'},{role:'user',created_at:'2026-10-07T02:00:00Z'}],7,now);
assert.equal(metrics.pending,1); assert.equal(metrics.oldDrafts,1);
assert.equal(metrics.todayRegistered,1); assert.equal(metrics.published,1); assert.equal(metrics.previousPublished,1);
assert.equal(metrics.views,2); assert.equal(metrics.daily.reduce((sum,d)=>sum+(d.views||0),0),2);
assert.equal(metrics.cumulativeViews,24); assert.equal(metrics.bookmarks,4); assert.equal(metrics.likes,2);
assert.equal(metrics.qualityIssues.length,1); assert.equal(metrics.categories.find(c=>c.label==='에디토리얼').count,1);
assert.equal(metrics.membersTotal,2); assert.equal(metrics.newMembers,1);
assert.equal(buildDashboardMetrics([{...post,category:'interiors'}],[],null,7,now).categories.find(c=>c.label==='인테리어').count,1);
const privateMetrics=buildDashboardMetrics([post],views,null,7,now);
assert.equal(privateMetrics.views,1); assert.equal(privateMetrics.membersTotal,null); assert.equal(privateMetrics.memberGroups,null);
const unavailable=buildDashboardMetrics([],null,null,7,now);
assert.equal(unavailable.views,null); assert.ok(unavailable.daily.every(d=>d.views===null));
assert.equal(unavailable.pending,0); assert.equal(unavailable.topArticles.length,0);
assert.equal(periodChange(0,0),'직전 기간과 동일');
assert.equal(periodChange(2,0),'직전 기간 0 → 2건');
assert.equal(periodChange(6,4),'직전 기간 대비 +50%');
assert.equal(periodChange(null,4),'기록을 확인할 수 없음');
if(process.argv[2]) {
  const base=process.argv[2];
  for(const route of ['/dashboard','/dashboard?days=30','/dashboard/analytics']) {
    const response=await fetch(new URL(route,base),{redirect:'manual'});
    assert.equal(response.status,307,'Dashboard metrics must not be exposed to anonymous visitors');
    assert.ok(response.headers.get('location')?.includes('/login'));
  }
}
if(process.argv.includes('--live')) {
  const {createClient}=await import('@supabase/supabase-js');
  const {editorialSchema}=await import('../lib/news-editorial.ts');
  assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,'overgjynkrnwayfammid.supabase.co','Read only the ARCH.B project');
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  const result=await db.from('posts').select('id,type,title,slug,is_published,created_at,published_at,view_count,scrap_count,like_count,category:content->>category,author_id').in('type',['news','blog']).order('id');
  assert.equal(result.error,null);
  assert.ok(result.data.length<1000,'Live smoke fixture must not be truncated');
  const period=dashboardPeriod(7);
  const viewResult=await db.from('post_views').select('post_id,created_at,posts!inner(author_id,type)').in('posts.type',['news','blog']).gte('created_at',period.previousStart).lte('created_at',period.now);
  assert.equal(viewResult.error,null); assert.ok(viewResult.data.length<1000);
  const admins=await db.from('users').select('id').eq('role','admin'); assert.equal(admins.error,null);
  const adminIds=admins.data.map(u=>u.id);
  const subViews=await db.from('post_views').select('post_id,created_at,posts!inner(author_id,type)').in('posts.type',['news','blog']).gte('created_at',period.previousStart).lte('created_at',period.now).not('posts.author_id','in',`(${adminIds.join(',')})`);
  assert.equal(subViews.error,null); assert.ok(subViews.data.every(v=>v.posts.author_id&&!adminIds.includes(v.posts.author_id)),'Sub-admin joined views must exclude admin content');
  const owner=result.data.find(p=>p.author_id)?.author_id;
  if(owner) {
    const ownViews=await db.from('post_views').select('post_id,created_at,posts!inner(author_id,type)').in('posts.type',['news','blog']).gte('created_at',period.previousStart).lte('created_at',period.now).eq('posts.author_id',owner);
    assert.equal(ownViews.error,null); assert.ok(ownViews.data.every(v=>v.posts.author_id===owner),'Editor joined views must stay within the author scope');
  }
  const quality=await db.from('posts').select('title,summary,tags,source_url:content->>source_url,paragraphs:content->paragraphs,points:content->points').eq('type','news').eq('is_published',true);
  assert.equal(quality.error,null);
  const live=buildDashboardMetrics(result.data,viewResult.data,null,7,new Date(period.now));
  assert.equal(live.categories.reduce((sum,c)=>sum+c.count,0),result.data.filter(p=>p.is_published).length);
  assert.equal(live.daily.reduce((sum,d)=>sum+(d.views||0),0),live.views);
  console.log(JSON.stringify({pending:live.pending,registered:live.registered,published:live.published,views:live.views,categories:live.categories,qualityChecks:quality.data.map(p=>{const parsed=editorialSchema.safeParse({url:p.source_url,title:p.title,summary:p.summary,paragraphs:p.paragraphs,points:p.points,tags:p.tags});return {title:p.title,ready:parsed.success,issues:parsed.success?[]:[...new Set(parsed.error.issues.map(i=>i.message))]};})}));
}
console.log('ARCH.B dashboard checks passed: Korean date boundaries, periods, scoped views, publication dates, current reactions, missing/zero data and anonymous access.');
