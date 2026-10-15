'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TrafficStats } from '@/lib/site-traffic';
import ContentPagination from '../components/ContentPagination';

const number = (value: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value);

export default function VisitorPopularPages({ pages, pageviews }: { pages: TrafficStats['pages']; pageviews: number }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(pages.length / 10);
  const current = Math.min(page, Math.max(1, totalPages));
  const start = (current - 1) * 10;
  return <section className="operation-card" id="visitor-popular-pages" aria-labelledby="visitor-popular-heading">
    <div className="operation-section-heading"><div><h2 id="visitor-popular-heading">인기 페이지</h2><p>페이지 조회 순 · 상위 20개 · 비중은 전체 조회 기준</p></div><span className="operation-pill">{pages.length}개 페이지</span></div>
    {pages.length ? <>
      <div className="operation-table-scroll" role="region" aria-label="인기 페이지 표" tabIndex={0}>
        <table className="operation-table visitor-table visitor-pages-table"><thead><tr><th scope="col">순위</th><th scope="col">페이지</th><th scope="col">방문자</th><th scope="col">조회 · 비중</th></tr></thead><tbody>
          {pages.slice(start, start + 10).map((item, index) => <tr key={item.path}>
            <td className="visitor-rank">{start + index + 1}</td>
            <th scope="row"><Link className="visitor-page-title" href={item.path} target="_blank" rel="noopener noreferrer" title={`${item.title || item.section}\n${item.path} (새 탭)`}>{item.title || item.section}</Link><div className="visitor-page-meta"><span className="visitor-section-tag">{item.section}</span><span className="visitor-page-path" title={item.path}>{item.path}</span></div></th>
            <td>{number(item.visitors)}</td>
            <td><div className="visitor-view-count"><strong>{number(item.count)}</strong><span>{number(pageviews ? item.count / pageviews * 100 : 0)}%</span></div><progress className="visitor-share" aria-label={`${item.title || item.section} 전체 조회 비중`} value={item.count} max={Math.max(1, pageviews)} /></td>
          </tr>)}
        </tbody></table>
      </div>
      <div className="visitor-table-footer"><p aria-live="polite">{start + 1}–{Math.min(start + 10, pages.length)} / {pages.length}개 페이지</p><ContentPagination label="인기 페이지 목록" page={current} totalPages={totalPages} onPageChange={setPage} /></div>
    </> : <p className="operation-empty">아직 조회된 페이지가 없습니다.</p>}
  </section>;
}
