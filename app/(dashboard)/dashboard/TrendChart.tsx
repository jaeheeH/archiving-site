'use client';

import { useEffect, useRef, useState } from 'react';

type Day = { date: string; registered: number; published: number; views: number | null; visitors?: number; sessions?: number };

export default function TrendChart({ daily, mode }: { daily: Day[]; mode: 'publishing' | 'views' | 'visitors' }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => {
      const width = element.clientWidth, height = 230, ratio = window.devicePixelRatio || 1;
      element.width = width * ratio; element.height = height * ratio;
      const ctx = element.getContext('2d');
      if (!ctx) return;
      const style = getComputedStyle(element);
      const brand = style.getPropertyValue('--archive-brand').trim() || '#1a8917';
      const ink = style.getPropertyValue('--archive-ink').trim() || '#242424';
      const line = style.getPropertyValue('--archive-line').trim() || '#e9e9e9';
      const muted = style.getPropertyValue('--archive-muted').trim() || '#6b6b6b';
      ctx.scale(ratio, ratio);
      const left = 32, right = width - 14, top = 12, bottom = height - 30;
      const series = mode === 'views' ? [daily.map(d => d.views || 0)] : mode === 'visitors' ? [daily.map(d => d.visitors || 0), daily.map(d => d.sessions || 0)] : [daily.map(d => d.registered), daily.map(d => d.published)];
      const largest = Math.max(1, ...series.flat());
      const step = Math.max(1, Math.ceil(largest / 4)), max = step * 4;
      const x = (i: number) => left + (right - left) * (mode === 'views' ? (i + .5) / daily.length : i / Math.max(1, daily.length - 1));
      const y = (n: number) => bottom - n / max * (bottom - top);
      ctx.font = '11px Pretendard, sans-serif'; ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const pos = y(i * step);
        ctx.strokeStyle = line; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(left, pos); ctx.lineTo(right, pos); ctx.stroke();
        ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.fillText(String(i * step), left - 8, pos);
      }
      ctx.setLineDash([]);
      series.forEach((points, index) => {
        const color = mode === 'views' || index === 1 ? brand : ink;
        if (mode === 'views') {
          const barWidth = Math.min(34, (right - left) / daily.length * .55);
          ctx.fillStyle = color;
          points.forEach((n, i) => { ctx.beginPath(); ctx.roundRect(x(i) - barWidth / 2, y(n), barWidth, bottom - y(n), [4, 4, 0, 0]); ctx.fill(); });
        } else {
          ctx.beginPath(); points.forEach((n, i) => i ? ctx.lineTo(x(i), y(n)) : ctx.moveTo(x(i), y(n)));
          ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
          ctx.lineTo(x(points.length - 1), bottom); ctx.lineTo(x(0), bottom); ctx.closePath();
          ctx.fillStyle = color; ctx.globalAlpha = index ? .06 : .035; ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = color; points.forEach((n, i) => { ctx.beginPath(); ctx.arc(x(i), y(n), 2.5, 0, Math.PI * 2); ctx.fill(); });
        }
      });
      ctx.fillStyle = muted; ctx.textAlign = 'center';
      const labelEvery = Math.ceil(daily.length / Math.max(2, Math.floor(width / 75)));
      daily.forEach((d, i) => { if (i % labelEvery === 0 || i === daily.length - 1) ctx.fillText(d.date.slice(5).replace('-', '.'), x(i), height - 10); });
    };
    const observer = new ResizeObserver(draw); observer.observe(element); draw();
    const themeObserver = new MutationObserver(draw);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    document.fonts.ready.then(draw);
    return () => { observer.disconnect(); themeObserver.disconnect(); };
  }, [daily, mode]);
  const selected = active === null ? null : daily[active];
  const labels = mode === 'visitors' ? ['방문자', '방문 횟수'] : ['뉴스 등록', '기사 발행'];
  const unavailable = mode === 'views' && daily.every(d => d.views === null);
  return (
    <div className="operation-chart">
      {unavailable ? <p className="chart-unavailable">조회 기록을 불러올 수 없습니다.</p> : <canvas ref={canvas} role="img" aria-label={mode === 'views' ? '일별 기사 조회 기록. 아래 데이터 표에서 정확한 값을 확인할 수 있습니다.' : `일별 ${labels.join('·')} 추이. 아래 데이터 표에서 정확한 값을 확인할 수 있습니다.`}
        onPointerMove={event => { const box = event.currentTarget.getBoundingClientRect(); setActive(Math.min(daily.length - 1, Math.max(0, Math.round((event.clientX - box.left - 32) / Math.max(1, box.width - 46) * (daily.length - 1))))); }} onPointerLeave={() => setActive(null)} />}
      <p className="chart-readout" aria-live="polite">{selected ? `${selected.date} · ${mode === 'views' ? `조회 ${selected.views ?? '집계 불가'}건` : mode === 'visitors' ? `방문자 ${selected.visitors}명 · 방문 ${selected.sessions}회` : `뉴스 등록 ${selected.registered}편 · 기사 발행 ${selected.published}편`}` : '차트 위에 커서를 올리거나 아래 표에서 일별 수치를 확인하세요.'}</p>
      <details className="chart-data"><summary>데이터 표 보기</summary><div tabIndex={0} role="region" aria-label="일별 통계 표"><table><caption className="sr-only">일별 {mode === 'views' ? '기사 조회' : labels.join('·')} 수치</caption><thead><tr><th scope="col">날짜</th>{mode === 'views' ? <th scope="col">조회 기록</th> : <><th scope="col">{labels[0]}</th><th scope="col">{labels[1]}</th></>}</tr></thead><tbody>{daily.map(d => <tr key={d.date}><th scope="row">{d.date}</th>{mode === 'views' ? <td>{d.views ?? '집계 불가'}</td> : <><td>{mode === 'visitors' ? d.visitors : d.registered}</td><td>{mode === 'visitors' ? d.sessions : d.published}</td></>}</tr>)}</tbody></table></div></details>
    </div>
  );
}
