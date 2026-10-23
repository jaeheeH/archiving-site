import Link from 'next/link';
import type { ReactNode } from 'react';
import { dashboardPeriod } from '@/lib/dashboard-metrics';
import { ANALYTICS_DAYS } from '@/lib/engagement';
import { AnalyticsNav } from '../AnalyticsLayout';
import '../../dashboard.css';

const sections = { overview: '개요', sessions: '방문 상세 기록', pages: '인기 페이지' };
const path = (section: string) => `/dashboard/analytics/visitors${section === 'overview' ? '' : `/${section}`}`;

export default function VisitorPage({ children, days, section }: { children: ReactNode; days: number; section: keyof typeof sections }) {
  const period = dashboardPeriod(days);
  return <div className="operations-dashboard">
    <header className="dashboard-Header operations-header">
      <div><nav className="operation-breadcrumb" aria-label="현재 위치"><Link href="/dashboard/analytics">통계</Link> / {section === 'overview' ? '방문자 분석' : <><Link href={`${path('overview')}?days=${days}`}>방문자 분석</Link> / {sections[section]}</>}</nav><h1>{section === 'overview' ? '방문자 분석' : sections[section]}</h1><p className="operation-subtitle">공개 사이트의 유입과 콘텐츠 탐색 흐름 · 한국 시간</p></div>
      <div className="operation-period"><nav aria-label="통계 기간">{ANALYTICS_DAYS.map(value => <Link key={value} href={`${path(section)}?days=${value}`} aria-current={value === days ? 'page' : undefined}>{value}일</Link>)}</nav><time>{period.dates[0]} – {period.today}</time></div>
    </header>
    <main className="dashboard-container operations-main">
      <AnalyticsNav section="visitors" days={days} />
      <nav className="visitor-page-nav" aria-label="방문자 분석 메뉴">{Object.entries(sections).map(([key, label]) => <Link key={key} href={`${path(key)}?days=${days}`} aria-current={key === section ? 'page' : undefined}>{label}</Link>)}</nav>
      {children}
    </main>
  </div>;
}
