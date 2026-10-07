import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getArtCatalog } from '@/lib/art-catalog';
import { getDashboardContext } from '@/lib/dashboard-data';
import CatalogEditor from './CatalogEditor';
import ContentPagination from '@/app/(dashboard)/components/ContentPagination';

type Kind = 'art' | 'artists';
const label = { art: '아트', artists: '작가' };

export default async function CatalogPage({ kind, searchParams }: { kind: Kind; searchParams: Promise<{ q?: string; page?: string }> }) {
  const context = await getDashboardContext();
  if (!context) redirect(`/login?redirect=/dashboard/contents/${kind}`);
  const catalog = await getArtCatalog();
  const writable = ['admin', 'sub-admin'].includes(context.role) && catalog.databaseReady;
  const { q = '', page: rawPage = '1' } = await searchParams;
  const query = q.slice(0, 100).trim().toLocaleLowerCase('ko');
  const rows = (kind === 'art' ? catalog.artworks.map(work => ({ id: work.id, title: work.title_ko, description: `${work.artist} · ${work.museum}`, image: work.preview_url })) : catalog.artists.map(artist => ({ id: artist.id, title: artist.name_ko || artist.name, description: `${artist.name} · 작품 ${artist.artwork_ids.length}점`, image: '' }))).filter(row => `${row.title} ${row.description}`.toLocaleLowerCase('ko').includes(query));
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const page = Math.min(pages, Math.max(1, Number.parseInt(rawPage, 10) || 1));
  return <div>
    <header className="dashboard-Header"><div><h1>{label[kind]} 관리</h1><p className="mt-1 text-xs text-gray-500">공개 아카이브의 정보와 연결 관계를 관리합니다.</p></div>{writable && <Link className="content-table-create" href={`/dashboard/contents/${kind}/create`}><i className="ri-add-line" aria-hidden="true" />추가</Link>}</header>
    <main className="dashboard-container space-y-5">
      {!catalog.databaseReady && <p role="status" className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">DB 이전 대기 중입니다. 현재 아카이브를 조회할 수 있으며, 이전 후 편집할 수 있습니다.</p>}
      {context.role === 'editor' && <p className="text-sm text-gray-500">에디터는 조회할 수 있습니다. 편집은 관리자·부관리자가 담당합니다.</p>}
      <form method="get" className="content-table-filters"><label className="sr-only" htmlFor="catalog-query">{label[kind]} 검색</label><input id="catalog-query" type="search" name="q" defaultValue={q} maxLength={100} placeholder={`${label[kind]} 검색`} className="min-w-0 rounded border border-gray-200 bg-white" /><button className="content-table-action">검색</button>{q && <Link href={`/dashboard/contents/${kind}`} className="content-table-action">초기화</Link>}</form>
      <p className="content-table-meta">총 {rows.length}{kind === 'art' ? '점' : '명'}</p>
      <div className="content-table-wrap">
        <table className="content-table content-table-compact text-left" aria-label={`${label[kind]} 목록`}>
          <thead><tr><th className="content-table-title">{kind === 'art' ? '작품' : '작가'}</th><th>{kind === 'art' ? '작가 · 소장처' : '원문 이름 · 작품 수'}</th><th className="content-table-action-cell">관리</th></tr></thead>
          <tbody>
            {rows.slice((page - 1) * 20, page * 20).map(row => <tr key={row.id} className="border-b hover:bg-gray-50"><td><div className="flex min-w-0 items-center gap-3">{row.image && <img src={row.image} alt="" className="h-8 w-12 shrink-0 rounded object-contain" referrerPolicy="no-referrer" />}<Link href={`/dashboard/contents/${kind}/${row.id}/edit`} className="min-w-0 truncate text-sm font-medium hover:underline" title={row.title}>{row.title}</Link></div></td><td><p className="line-clamp-2 text-sm text-gray-500">{row.description}</p></td><td className="content-table-action-cell"><Link href={`/dashboard/contents/${kind}/${row.id}/edit`} className="content-table-action" aria-label={`${row.title} ${writable ? '수정' : '조회'}`}><i className={writable ? 'ri-edit-line' : 'ri-eye-line'} aria-hidden="true" />{writable ? '수정' : '조회'}</Link></td></tr>)}
            {!rows.length && <tr><td colSpan={3} className="p-10 text-center text-sm text-gray-500">검색 결과가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      <ContentPagination label={`${label[kind]} 페이지`} page={page} totalPages={pages} href={number => `?q=${encodeURIComponent(q)}&page=${number}`} />
    </main>
  </div>;
}

export async function CatalogEditPage({ kind, id }: { kind: Kind; id?: string }) {
  const context = await getDashboardContext();
  if (!context) redirect(`/login?redirect=/dashboard/contents/${kind}`);
  const catalog = await getArtCatalog();
  const row = id ? (kind === 'art' ? catalog.artworks : catalog.artists).find(row => row.id === id) : undefined;
  if (id && !row) notFound();
  const writable = ['admin', 'sub-admin'].includes(context.role) && catalog.databaseReady;
  if (!id && !writable) redirect(`/dashboard/contents/${kind}`);
  return <CatalogEditor kind={kind} row={row} artists={catalog.artists} writable={writable} />;
}
