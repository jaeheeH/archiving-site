import Link from 'next/link';

type Props = { page: number; totalPages: number; label: string } & (
  { href: (page: number) => string; onPageChange?: never } |
  { href?: never; onPageChange: (page: number) => void }
);

export default function ContentPagination({ page, totalPages, label, href, onPageChange }: Props) {
  const last = Math.max(1, Number.isFinite(totalPages) ? Math.trunc(totalPages) : 1);
  if (last === 1) return null;
  const current = Math.min(last, Math.max(1, Number.isFinite(page) ? Math.trunc(page) : 1));
  const start = Math.max(1, Math.min(current - 2, last - 4));
  const control = (target: number, name: string, icon?: string, disabled = false) => {
    const numbered = !icon;
    const props = { 'aria-label': `${name} 페이지`, title: name, 'aria-current': numbered && target === current ? 'page' as const : undefined, className: numbered ? 'content-pagination-page' : undefined, 'data-distant': numbered && Math.abs(target - current) > 1 ? 'true' : undefined };
    const content = icon ? <i className={icon} aria-hidden="true" /> : target;
    if (disabled) return <button type="button" {...props} disabled>{content}</button>;
    return href
      ? <Link href={href(target)} {...props}>{content}</Link>
      : <button type="button" onClick={() => onPageChange?.(target)} {...props}>{content}</button>;
  };
  return <nav className="content-table-pagination" aria-label={label}>
    {control(1, '처음', 'ri-arrow-left-double-line', current === 1)}
    {control(current - 1, '이전', 'ri-arrow-left-s-line', current === 1)}
    <div className="content-pagination-pages">{Array.from({ length: Math.min(5, last) }, (_, i) => start + i).map(number => <span key={number}>{control(number, String(number))}</span>)}</div>
    {control(current + 1, '다음', 'ri-arrow-right-s-line', current === last)}
    {control(last, '마지막', 'ri-arrow-right-double-line', current === last)}
  </nav>;
}
