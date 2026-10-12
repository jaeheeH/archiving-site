'use client';
import { useState, type FormEvent } from 'react';
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Artist, Artwork } from '@/lib/art-catalog';

export default function CatalogEditor({ kind, row, artists, articles = [], writable }: { kind: 'art' | 'artists'; row?: Artist | Artwork; artists: Artist[]; articles?: { id: string; title: string }[]; writable: boolean }) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [issues, setIssues] = useState<{ field: string; message: string }[]>([]);
  const label = kind === 'art' ? '아트' : '작가';
  const work = row && 'title' in row ? row : undefined;
  const artist = row && 'name' in row ? row : undefined;
  useUnsavedChanges(dirty);
  const field = (name: string, label: string, value = '', type = 'text', maxLength = 500) => <label className="block text-sm font-medium">{label}<input name={name} defaultValue={value} type={type} maxLength={maxLength} aria-invalid={issues.some(issue => issue.field === name)} className="mt-2 w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm" />{issues.filter(issue => issue.field === name).map((issue, i) => <span key={i} className="mt-1 block text-xs text-red-700">{issue.message}</span>)}</label>;
  const textarea = (name: string, label: string, value = '', maxLength = 1500) => <label className="block text-sm font-medium md:col-span-2">{label}<textarea name={name} defaultValue={value} rows={3} maxLength={maxLength} aria-invalid={issues.some(issue => issue.field === name)} className="mt-2 w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm" />{issues.filter(issue => issue.field === name).map((issue, i) => <span key={i} className="mt-1 block text-xs text-red-700">{issue.message}</span>)}</label>;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!writable || busy) return;
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) || '').trim();
    const list = (name: string) => value(name).split(/\n|,/).map(item => item.trim()).filter(Boolean);
    const data = kind === 'artists' ? { name: value('name'), name_ko: value('name_ko') || null, source_ids: list('source_ids'), profile: {
      description: value('profile.description'), lifespan: value('profile.lifespan'), context: value('profile.context'),
      sources: Array.from({ length: 5 }, (_, index) => ({ label: value(`profile.sources.${index}.label`), url: value(`profile.sources.${index}.url`) })).filter(source => source.label || source.url),
      related_post_ids: form.getAll('profile.related_post_ids').map(String),
    } } : {
      ...Object.fromEntries(['title', 'title_ko', 'museum', 'artist', 'date', 'medium', 'medium_ko', 'dimensions', 'dimensions_ko', 'culture', 'accession', 'source_url', 'preview_url', 'policy_url', 'license'].map(name => [name, value(name)])),
      artist_ids: form.getAll('artist_ids').map(String), themes: list('themes'), image_width: Number(value('image_width')), image_height: Number(value('image_height')),
    };
    setBusy(true); setError(''); setIssues([]);
    try {
      const resource = kind === 'art' ? 'artworks' : 'artists';
      const response = await fetch(`/api/admin/${resource}${row ? `/${row.id}` : ''}`, { method: row ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) { setIssues(result.issues || []); throw new Error(result.error || '저장하지 못했습니다.'); }
      setDirty(false);
      router.push(`/dashboard/contents/${kind}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  return <div>
    <header className="dashboard-Header"><h1>{label} {row ? writable ? '편집' : '조회' : '추가'}</h1><Link href={`/dashboard/contents/${kind}`} className="content-table-action">목록으로</Link></header>
    <main className="dashboard-container"><form onSubmit={save} onChange={() => setDirty(true)} className="max-w-4xl space-y-6 rounded-lg border border-gray-200 bg-white p-6">
      <fieldset disabled={!writable || busy} className="grid gap-5 md:grid-cols-2">
        {kind === 'artists' ? <>
          {field('name', '원문 이름', artist?.name, 'text', 200)}{field('name_ko', '한국어 이름', artist?.name_ko || '', 'text', 200)}{field('source_ids', '기관별 작가 ID · 쉼표로 구분', artist?.source_ids.join(', '))}
          <p className="self-center text-xs leading-6 text-gray-500">공식 기관 자료로 확인한 내용만 작성합니다. 불명확한 생몰연도는 추정임을 표시하거나 비워두세요.</p>
          {field('profile.lifespan', '생몰연도 · 확인된 표기', artist?.profile?.lifespan, 'text', 100)}{field('profile.context', '활동 지역·분야', artist?.profile?.context, 'text', 200)}
          {textarea('profile.description', '짧은 작가 소개', artist?.profile?.description)}
          <fieldset className="space-y-4 rounded-md border p-4 md:col-span-2"><legend className="px-1 text-sm font-medium">소개 출처</legend><p className="text-xs text-gray-500">소개가 있으면 출처가 한 곳 이상 필요합니다. 사용하지 않는 행은 비워두세요.</p>{Array.from({ length: 5 }, (_, index) => <div key={index} className="grid gap-3 sm:grid-cols-2">{field(`profile.sources.${index}.label`, `출처 ${index + 1} · 기관·자료명`, artist?.profile?.sources?.[index]?.label, 'text', 200)}{field(`profile.sources.${index}.url`, `출처 ${index + 1} · URL`, artist?.profile?.sources?.[index]?.url, 'url', 2000)}</div>)}{issues.filter(issue => issue.field === 'profile.sources').map((issue, i) => <p key={i} className="text-xs text-red-700">{issue.message}</p>)}</fieldset>
          <fieldset className="space-y-3 rounded-md border p-4 md:col-span-2"><legend className="px-1 text-sm font-medium">함께 읽는 글</legend><p className="text-xs text-gray-500">관련 있는 발행 뉴스·에디토리얼을 최대 6편 선택합니다. 이후 발행을 취소한 글은 공개 화면에서 숨겨집니다.</p><div className="max-h-64 space-y-3 overflow-y-auto">{[...articles, ...(artist?.profile?.related_post_ids || []).filter(id => !articles.some(article => article.id === id)).map(id => ({ id, title: `비공개 또는 삭제된 글 · ${id}` }))].map(article => <label key={article.id} className="flex items-start gap-2 text-sm leading-6"><input type="checkbox" name="profile.related_post_ids" value={article.id} defaultChecked={artist?.profile?.related_post_ids?.includes(article.id)} className="mt-1" />{article.title}</label>)}</div>{issues.filter(issue => issue.field === 'profile.related_post_ids').map((issue, i) => <p key={i} className="text-xs text-red-700">{issue.message}</p>)}</fieldset>
        </> : <>
          {field('title', '원문 제목', work?.title, 'text', 300)}{field('title_ko', '한국어 제목', work?.title_ko, 'text', 300)}{field('museum', '소장처', work?.museum)}{field('artist', '원출처 작가 표기', work?.artist)}
          <fieldset className="space-y-2 rounded-md border p-4 md:col-span-2"><legend className="px-1 text-sm font-medium">연결 작가</legend><div className="grid gap-2 sm:grid-cols-2">{artists.map(person => <label key={person.id} className="flex items-center gap-2 text-sm"><input name="artist_ids" type="checkbox" value={person.id} defaultChecked={work?.artist_ids.includes(person.id)} />{person.name_ko || person.name}</label>)}</div></fieldset>
          {field('date', '제작 시기', work?.date)}{field('culture', '문화', work?.culture)}
          {field('medium_ko', '재료·기법 · 한국어', work?.medium_ko)}{field('medium', '재료·기법 · 원문', work?.medium)}
          {textarea('dimensions_ko', '작품 크기 · 한국어 (cm 기준)', work?.dimensions_ko)}{textarea('dimensions', '작품 크기 · 원문', work?.dimensions, 500)}
          <p className="text-xs leading-6 text-gray-500 md:col-span-2">한국어 정보가 있으면 먼저 표시합니다. 원문은 상세 페이지에서 펼쳐 볼 수 있습니다. 작품 자체·액자 포함·전체 크기를 구분하고, 원출처의 수치 순서를 유지해주세요.</p>
          {field('accession', '소장품 번호', work?.accession)}{field('themes', '주제 · 쉼표로 구분', work?.themes.join(', '))}
          {field('source_url', '원출처 URL', work?.source_url, 'url', 2000)}{field('preview_url', '이미지 URL', work?.preview_url, 'url', 2000)}{field('license', '이용 표시', work?.license)}{field('policy_url', '이용 정책 URL', work?.policy_url, 'url', 2000)}{field('image_width', '이미지 너비 (px)', String(work?.image_width || 1000), 'number')}{field('image_height', '이미지 높이 (px)', String(work?.image_height || 1000), 'number')}
        </>}
      </fieldset>
      {artist?.artwork_ids.length ? <section><h2 className="mb-2 text-sm font-semibold">연결된 작품</h2><div className="flex flex-wrap gap-3">{artist.artwork_ids.map(id => <Link key={id} href={`/dashboard/contents/art/${id}/edit`} className="text-sm text-emerald-700 underline">{id}</Link>)}</div><p className="mt-2 text-xs text-gray-500">작품 편집에서 작가 연결을 변경할 수 있습니다.</p></section> : null}
      {row && <Link href={`/${kind}/${row.id}`} target="_blank" className="inline-block text-sm text-emerald-700">공개 화면 보기 ↗</Link>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {writable ? <button disabled={busy} className="content-table-create">{busy ? '저장 중…' : '저장'}</button> : <p className="text-sm text-gray-500">조회 모드입니다.</p>}
    </form></main>
  </div>;
}
