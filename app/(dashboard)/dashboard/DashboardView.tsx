import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight, Bookmark, CheckCheck, Eye, FileText, Heart, ImageIcon, Newspaper, Palette, Users } from 'lucide-react';
import { getDashboardOverview } from '@/lib/dashboard-data';
import { periodChange } from '@/lib/dashboard-metrics';
import TrendChart from './TrendChart';
import VisitorAnalytics from './VisitorAnalytics';
import './dashboard.css';

const number = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('ko-KR').format(value);
type Params = Promise<{ days?: string }>;

export default async function DashboardView({ searchParams, analytics = false }: { searchParams: Params; analytics?: boolean }) {
  const { days: rawDays } = await searchParams;
  const days = [5, 7, 30].includes(Number(rawDays)) ? Number(rawDays) : 7;
  const overview = await getDashboardOverview(days);
  if (!overview?.operations) redirect('/login?redirect=/dashboard');
  const metrics = overview.operations;
  const admin = ['admin', 'sub-admin'].includes(overview.viewer.role);
  const base = analytics ? '/dashboard/analytics' : '/dashboard';
  const articles = metrics.topArticles.slice(0, analytics ? 15 : 5);
  const cards = [
    { label: '뉴스 가공 대기', value: metrics.pending, unit: '편', detail: `7일 이상 대기 ${number(metrics.oldDrafts)}편`, href: '/dashboard/contents/news', icon: Newspaper },
    { label: '오늘 등록 뉴스', value: metrics.todayRegistered, unit: '편', detail: `최근 ${days}일 ${number(metrics.registered)}편 등록`, href: '#publishing-trend', icon: FileText },
    { label: `최근 ${days}일 발행`, value: metrics.published, unit: '편', detail: periodChange(metrics.published, metrics.previousPublished, '편'), href: '#publishing-trend', icon: CheckCheck },
    { label: `최근 ${days}일 기사 조회`, value: metrics.views, unit: '건', detail: periodChange(metrics.views, metrics.previousViews), href: '#article-performance', icon: Eye },
    { label: '북마크 · 좋아요', value: metrics.bookmarks + metrics.likes, unit: '건', detail: `북마크 ${number(metrics.bookmarks)} · 좋아요 ${number(metrics.likes)}`, href: '#article-performance', icon: Heart },
  ];
  const shortcuts = [
    { label: '뉴스', count: overview.stats.newsTotal, href: '/dashboard/contents/news', icon: Newspaper },
    { label: '아트', count: overview.stats.artworksTotal, href: '/dashboard/contents/art', icon: Palette },
    { label: '작가', count: overview.stats.artistsTotal, href: '/dashboard/contents/artists', icon: Users },
    { label: '참고사이트', count: overview.stats.referencesTotal, href: '/dashboard/contents/references', icon: Bookmark },
    { label: '에디토리얼', count: overview.stats.postsTotal, href: '/dashboard/contents/blog', icon: FileText },
    { label: '갤러리', count: overview.stats.galleryTotal, href: '/dashboard/contents/gallery', icon: ImageIcon },
  ];
  const insights = [
    { title: metrics.pending ? `뉴스 ${number(metrics.pending)}편이 가공을 기다립니다` : '가공 대기 뉴스가 없습니다', text: `전체 뉴스 ${number(overview.stats.newsTotal)}편 중 ${number(overview.stats.newsPublished)}편이 발행 상태입니다. 자료 조사와 초안 검토부터 진행하세요.`, href: '/dashboard/contents/news', action: '뉴스 관리' },
    { title: !metrics.qualityAvailable ? '발행 기사 품질 점검을 확인할 수 없습니다' : metrics.qualityIssues.length ? `발행 뉴스 ${number(metrics.qualityIssues.length)}편에 품질 확인이 필요합니다` : overview.stats.newsPublished ? '발행 뉴스가 현재 품질 기준을 충족합니다' : '아직 발행된 뉴스가 없습니다', text: metrics.qualityIssues[0]?.qualityReasons?.length ? `점검 예: ${metrics.qualityIssues[0].qualityReasons.slice(0,2).join(' ')} 기사 편집기에서 기준별 확인과 보강 초안 검토를 진행할 수 있습니다.` : '본문 1,800~3,000자, 사실·분석을 구분한 4~6개 섹션과 참고자료를 기준으로 점검합니다.', href: metrics.qualityIssues[0] ? `/dashboard/contents/news/${metrics.qualityIssues[0].id}/edit` : '/dashboard/contents/news', action: '기사 점검' },
    { title: metrics.views === null ? '기간 조회 기록을 확인할 수 없습니다' : metrics.views === 0 ? '선택 기간의 기사 조회 기록이 없습니다' : `최근 ${days}일 ${number(metrics.views)}건의 기사 조회가 기록됐습니다`, text: metrics.views ? '아래 기사별 조회와 북마크·좋아요를 함께 보며 후속 주제를 선정할 수 있습니다. 반응 수는 현재 저장된 누적 값입니다.' : '조회 기록은 기사별 24시간 중복을 제외합니다. 조회가 없는 기간에는 누적 조회 순위를 보여줍니다.', href: '#article-performance', action: '기사별 반응' },
  ];
  const periodLabel = `${metrics.period.dates[0].replaceAll('-', '.')} – ${metrics.period.today.replaceAll('-', '.')}`;
  return <div className="operations-dashboard">
    <header className="dashboard-Header operations-header">
      <div><p className="operation-breadcrumb">운영 / {analytics ? '통계' : '대시보드'}</p><h1>{analytics ? '운영 통계' : '운영 대시보드'}</h1><p className="operation-subtitle">{overview.viewer.nickname} · {overview.viewer.role === 'editor' ? '내 콘텐츠 기준' : overview.viewer.role === 'sub-admin' ? '관리자 작성 콘텐츠 제외' : '전체 콘텐츠 기준'} · 한국 시간</p></div>
      <div className="operation-period"><nav aria-label="통계 기간">{[5, 7, 30].map(n => <Link key={n} href={`${base}?days=${n}`} aria-current={days === n ? 'page' : undefined}>{n}일</Link>)}</nav><time dateTime={metrics.period.today}>{periodLabel}</time></div>
    </header>
    <main className="dashboard-container operations-main">
      {metrics.warnings.length > 0 && <div role="alert" className="operation-warning">{metrics.warnings.join(' ')}</div>}
      <section aria-labelledby="operation-status"><div className="operation-section-heading"><div><h2 id="operation-status">운영 현황</h2><p>가공·발행·독자 반응의 흐름을 확인하세요. 오늘 진행 중인 수치가 포함됩니다.</p></div></div>
        <div className="operation-kpis">{cards.map(card => { const Icon = card.icon; return <Link key={card.label} href={card.href} className="operation-card kpi-card"><div className="kpi-label"><span>{card.label}</span><span className="operation-icon"><Icon size={17} aria-hidden="true" /></span></div><p className="kpi-number">{number(card.value)}<span>{card.unit}</span></p><div className="kpi-detail"><span>{card.detail}</span><ArrowUpRight size={13} aria-hidden="true" /></div></Link>; })}</div>
      </section>
      {overview.traffic && <VisitorAnalytics traffic={overview.traffic} days={days} compact />}
      <div className="operation-charts">
        <section id="publishing-trend" className="operation-card"><div className="operation-section-heading"><div><h2>등록·발행 추이</h2><p>최근 {days}일 · 뉴스 등록일과 기사 발행일 기준</p></div>{admin && !analytics && <Link className="operation-pill" href={`/dashboard/analytics?days=${days}`}>전체 통계 <ArrowUpRight size={13} /></Link>}</div><div className="chart-legend"><span><i className="legend-registration" />뉴스 등록</span><span><i className="legend-publication" />기사 발행</span></div><TrendChart daily={metrics.daily} mode="publishing" /><div className="chart-totals"><div><span>오늘 등록 뉴스</span><strong>{number(metrics.todayRegistered)}편</strong></div><div><span>오늘 발행 기사</span><strong>{number(metrics.todayPublished)}편</strong></div></div></section>
        <section className="operation-card"><div className="operation-section-heading"><div><h2>기사 조회 흐름</h2><p>뉴스와 에디토리얼 · 기사별 24시간 중복 제외</p></div></div><TrendChart daily={metrics.daily} mode="views" /><div className="view-total"><span>최근 {days}일 합계</span><strong>{number(metrics.views)}건</strong><span>누적 조회 {number(metrics.cumulativeViews)}건</span></div></section>
      </div>
      <div className="operation-secondary">
        <section className="operation-card"><div className="operation-section-heading"><div><h2>{admin ? '회원 구성' : '내 기사 현황'}</h2><p>{admin ? '계정 권한별 회원 현황' : '뉴스와 에디토리얼의 발행·반응 현황'}</p></div>{admin && <Link href="/dashboard/users" className="operation-icon" aria-label="회원 관리"><ArrowUpRight size={15} /></Link>}</div><p className="operation-large">{number(admin ? metrics.membersTotal : metrics.publishedTotal)}<span>{admin ? '명 전체' : '편 발행'}</span></p>
          {admin ? metrics.memberGroups ? <><div className="operation-stacked" aria-label="회원 구성">{metrics.memberGroups.map((group,i) => group.count > 0 && <span key={group.label} style={{width:`${group.count / (metrics.membersTotal || 1) * 100}%`,background:['var(--archive-line)','var(--archive-brand)','#94b991','var(--archive-ink)'][i]}} title={`${group.label} ${group.count}명`} />)}</div><dl className="operation-count-list">{metrics.memberGroups.map(g => <div key={g.label}><dt>{g.label}</dt><dd>{number(g.count)}명</dd></div>)}</dl><p className="operation-footnote">최근 {days}일 신규 가입 {number(metrics.newMembers)}명</p></> : <p>회원 현황을 불러올 수 없습니다.</p> : <dl className="operation-count-list"><div><dt>뉴스 가공 대기</dt><dd>{number(metrics.pending)}편</dd></div><div><dt>누적 조회</dt><dd>{number(metrics.cumulativeViews)}건</dd></div><div><dt>북마크</dt><dd>{number(metrics.bookmarks)}건</dd></div><div><dt>좋아요</dt><dd>{number(metrics.likes)}건</dd></div></dl>}
        </section>
        <section className="operation-card"><div className="operation-section-heading"><div><h2>분야별 발행</h2><p>현재 공개된 뉴스와 에디토리얼 {number(metrics.publishedTotal)}편</p></div></div><div className="category-bars">{metrics.categories.map(g => <div key={g.label}><label htmlFor={`category-${g.label}`}>{g.label}</label><progress id={`category-${g.label}`} value={g.count} max={Math.max(1,metrics.publishedTotal)} /><strong>{number(g.count)}</strong></div>)}</div><p className="operation-footnote">발행 추이는 뉴스와 에디토리얼을 함께 집계합니다.</p></section>
        <section className="operation-card"><div className="operation-section-heading"><div><h2>콘텐츠 관리 바로가기</h2><p>콘텐츠 {number(overview.stats.contentTotal)}개 · 작가 프로필 별도</p></div></div><div className="operation-shortcuts">{shortcuts.map(item => { const Icon=item.icon; return <Link key={item.label} href={item.href}><span className="operation-icon"><Icon size={16} /></span><span>{item.label}</span><strong>{number(item.count)}</strong><ArrowUpRight size={12} /></Link>; })}</div><div className="operation-quick-create"><Link href="/dashboard/contents/blog/create">글 작성 <ArrowUpRight size={12} /></Link><Link href="/dashboard/contents/gallery/create">이미지 추가 <ArrowUpRight size={12} /></Link>{admin && <Link href="/dashboard/studio">AI Studio <ArrowUpRight size={12} /></Link>}</div></section>
      </div>
      <section className="operation-card" aria-labelledby="operation-analysis"><div className="operation-section-heading"><div><h2 id="operation-analysis">운영 분석</h2><p>실제 등록·발행·조회 기록과 현재 품질 기준에 따른 점검입니다.</p></div></div><div className="operation-insights">{insights.map((item,index) => <article key={item.title}><span className="insight-index">0{index+1}</span><h3>{item.title}</h3><p>{item.text}</p><Link href={item.href}>{item.action}<ArrowUpRight size={13} /></Link></article>)}</div></section>
      <section id="article-performance" className="operation-card"><div className="operation-section-heading"><div><h2>{metrics.hasPeriodViews ? `최근 ${days}일 조회 상위 기사` : '누적 조회 상위 기사'}</h2><p>{metrics.hasPeriodViews ? '선택 기간 조회 순 · 북마크와 좋아요는 현재 누적 수' : metrics.views === null ? '기간 조회를 확인할 수 없어 전체 누적 조회 순으로 표시합니다.' : '선택 기간에 조회가 없어 전체 누적 조회 순으로 표시합니다.'}</p></div><Link href="/news/stories" className="operation-pill">공개 기사 <ArrowUpRight size={13} /></Link></div>
        {articles.length > 0 ? <div className="operation-table-scroll" tabIndex={0} role="region" aria-label="기사별 반응 표"><table className="operation-table"><thead><tr><th scope="col">기사</th><th scope="col">기간 조회</th><th scope="col">누적 조회</th><th scope="col">북마크</th><th scope="col">좋아요</th></tr></thead><tbody>{articles.map(p => <tr key={p.id}><th scope="row"><span>{p.type === 'news' ? '뉴스' : '에디토리얼'}</span><Link href={p.slug ? `/news/read/${p.slug}` : `/dashboard/contents/${p.type === 'news' ? 'news' : 'blog'}/${p.id}/edit`}>{p.title}</Link></th><td>{metrics.views === null ? '—' : number(p.periodViews)}</td><td>{number(p.view_count || 0)}</td><td>{number(p.scrap_count || 0)}</td><td>{number(p.like_count || 0)}</td></tr>)}</tbody></table></div> : <p className="operation-empty">아직 발행된 기사가 없습니다.</p>}
      </section>
      <p className="operation-footnote">집계: {new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(metrics.period.now))} · 직전 기간의 같은 시각과 비교 · 조회는 방문자 수가 아닌 기사 조회 기록 · 북마크·좋아요는 취소를 반영한 현재 누적 수</p>
    </main>
  </div>;
}
