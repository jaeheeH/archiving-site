import Link from 'next/link';
import { metricNumber as number, metricRate as rate, metricTime as time, type EngagementStats } from '@/lib/engagement';

export function MeasurementNote({ since }: { since: string | null }) {
  return <p className="visitor-notice">{since ? `${new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(new Date(since))}부터 행동 지표를 수집합니다.` : '읽기·저장·검색 지표는 이 기능 적용 후의 방문부터 쌓입니다.'} 과거 조회에 읽기 깊이를 소급 적용하지 않습니다. 깊게 본 조회는 활성 30초 이상·본문 75% 이상 도달한 조회입니다. 끝부분 도달은 본문 90% 이상 노출 기준이며 실제 이해나 완독을 보장하지 않습니다.</p>;
}

export default function EngagementSummary({ stats, visitors, days }: { stats: EngagementStats; visitors: number; days: number }) {
  const cards = [
    ['다시 찾은 방문자', rate(stats.returningVisitors, visitors), `첫 방문 ${number(visitors-stats.returningVisitors)} · 재방문 ${number(stats.returningVisitors)}개 브라우저 · 보관 기록 기준`, 'visitors'],
    ['평균 활성 읽기', time(stats.activeSeconds), `본문 측정 ${number(stats.measured)}건 · 숨김·30초 이상 비활동 제외`, 'content'],
    ['깊게 본 조회', rate(stats.deepReads, stats.measured), `${number(stats.deepReads)} / ${number(stats.measured)}건 · 활성 30초·본문 75%`, 'content'],
    ['검색 후 결과 클릭', rate(stats.searchClicks, stats.searchCount), `${number(stats.searchClicks)} / ${number(stats.searchCount)}회 검색 · 결과 없음 ${number(stats.noResults)}회`, 'search'],
  ];
  return <div className="operation-kpis visitor-kpis">{cards.map(([label, value, detail, path]) => <Link key={label} className="operation-card kpi-card" href={`/dashboard/analytics/${path}?days=${days}`}><p className="kpi-label">{label}</p><p className="kpi-number">{value}</p><p className="kpi-detail">{detail}</p></Link>)}</div>;
}
