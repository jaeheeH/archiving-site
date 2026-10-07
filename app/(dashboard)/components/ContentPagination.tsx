import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = { page: number; totalPages: number; label: string; children?: ReactNode } & (
  { href: (page: number) => string; onPageChange?: never } |
  { href?: never; onPageChange: (page: number) => void }
);

export default function ContentPagination({ page, totalPages, label, children, href, onPageChange }: Props) {
  const control = (target: number, name: string, icon: string, disabled: boolean) => {
    const content = <i className={icon} aria-hidden="true" />;
    return href
      ? <Link href={href(target)} aria-label={`${name} 페이지`} title={name} aria-disabled={disabled} tabIndex={disabled ? -1 : undefined}>{content}</Link>
      : <button type="button" onClick={() => onPageChange?.(target)} aria-label={`${name} 페이지`} title={name} disabled={disabled}>{content}</button>;
  };
  return <nav className="content-table-pagination" aria-label={label}>
    {control(1, '처음', 'ri-arrow-left-double-line', page <= 1)}
    {control(Math.max(1, page - 1), '이전', 'ri-arrow-left-s-line', page <= 1)}
    {children ?? <span>{page} / {totalPages}</span>}
    {control(Math.min(totalPages, page + 1), '다음', 'ri-arrow-right-s-line', page >= totalPages)}
    {control(totalPages, '마지막', 'ri-arrow-right-double-line', page >= totalPages)}
  </nav>;
}
