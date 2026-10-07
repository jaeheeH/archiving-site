import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getArtCatalog } from '@/lib/art-catalog';
import { getDashboardContext } from '@/lib/dashboard-data';
import CatalogEditor from './CatalogEditor';

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
    <header className="dashboard-Header"><div><h1>{label[kind]} 관리</h1><p className="mt-1 text-xs text-gray-500">공개 아카이브의 정보와 연결 관계를 관리합니다.</p></div>{writable && <Link className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white" href={`/dashboard/contents/${kind}/create`}>추가</Link>}</header>
    <main className="dashboard-container space-y-5">
      {!catalog.databaseReady && <p role="status" className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">DB 이전 대기 중입니다. 현재 아카이브를 조회할 수 있으며, 이전 후 편집할 수 있습니다.</p>}
      {context.role === 'editor' && <p className="text-sm text-gray-500">에디터는 조회할 수 있습니다. 편집은 관리자·부관리자가 담당합니다.</p>}
      <form method="get" className="flex flex-wrap gap-3"><label className="sr-only" htmlFor="catalog-query">{label[kind]} 검색</label><input id="catalog-query" name="q" defaultValue={q} maxLength={100} placeholder={`${label[kind]} 검색`} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm" /><button className="rounded-md border px-4 py-2 text-sm">검색</button>{q && <Link href={`/dashboard/contents/${kind}`} className="p-2 text-sm">초기화</Link>}</form>
      <p className="text-sm text-gray-500">총 {rows.length}{kind === 'art' ? '점' : '명'}</p>
      <section className="divide-y rounded-lg border border-gray-200 bg-white" aria-label={`${label[kind]} 목록`}>
        {rows.slice((page - 1) * 20, page * 20).map(row => <Link key={row.id} href={`/dashboard/contents/${kind}/${row.id}/edit`} className="flex items-center gap-4 p-4 hover:bg-gray-50">{row.image && <img src={row.image} alt="" className="h-16 w-16 object-contain" referrerPolicy="no-referrer" />}<div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{row.title}</h2><p className="mt-1 text-xs text-gray-500">{row.description}</p></div><span className="shrink-0 text-xs text-gray-500">{writable ? '편집' : '조회'} →</span></Link>)}
        {!rows.length && <p className="p-10 text-center text-sm text-gray-500">검색 결과가 없습니다.</p>}
      </section>
      <nav className="flex gap-3 text-sm" aria-label="페이지 이동">{page > 1 && <Link href={`?q=${encodeURIComponent(q)}&page=${page - 1}`}>이전</Link>}<span>{page} / {pages}</span>{page < pages && <Link href={`?q=${encodeURIComponent(q)}&page=${page + 1}`}>다음</Link>}</nav>
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
