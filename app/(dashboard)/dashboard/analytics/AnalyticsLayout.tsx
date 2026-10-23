import Link from 'next/link';
import type { ReactNode } from 'react';
import { ANALYTICS_DAYS } from '@/lib/engagement';
import { dashboardPeriod } from '@/lib/dashboard-metrics';
import '../dashboard.css';

export const analyticsSections = { overview: ['통계 개요', '/dashboard/analytics'], visitors: ['방문자 분석', '/dashboard/analytics/visitors'], content: ['콘텐츠 분석', '/dashboard/analytics/content'], search: ['검색·이용 분석', '/dashboard/analytics/search'] } as const;

export function AnalyticsNav({ section, days }: { section: keyof typeof analyticsSections; days: number }) {
  return <nav className="visitor-page-nav" aria-label="통계 분석 메뉴">{Object.entries(analyticsSections).map(([key, [label, path]]) => <Link key={key} href={`${path}?days=${days}`} aria-current={key === section ? 'page' : undefined}>{label}</Link>)}</nav>;
}

export default function AnalyticsLayout({ section, days, children }: { section: keyof typeof analyticsSections; days: number; children: ReactNode }) {
  const [title, path] = analyticsSections[section], period = dashboardPeriod(days);
  return <div className="operations-dashboard"><header className="dashboard-Header operations-header">
    <div><nav className="operation-breadcrumb" aria-label="현재 위치"><Link href="/dashboard">운영</Link> / 통계</nav><h1>{title}</h1><p className="operation-subtitle">방문 증가 · 콘텐츠 반응 · 탐색 경험 · 한국 시간</p></div>
    <div className="operation-period"><nav aria-label="통계 기간">{ANALYTICS_DAYS.map(value => <Link key={value} href={`${path}?days=${value}`} aria-current={value === days ? 'page' : undefined}>{value}일</Link>)}</nav><time>{period.dates[0]} – {period.today}</time></div>
  </header><main className="dashboard-container operations-main"><AnalyticsNav section={section} days={days} />{children}</main></div>;
}
