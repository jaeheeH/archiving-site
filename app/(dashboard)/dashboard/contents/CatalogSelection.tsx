'use client';

import { useId, useState } from 'react';
import { matchesSearch } from '@/lib/search-text';
import ContentPagination from '../../components/ContentPagination';

type Option = { id: string; title: string; subtitle?: string };

export default function CatalogSelection({ name, label, description, placeholder, options, initialSelected = [], limit, errors = [], onChange }: {
  name: string; label: string; description: string; placeholder: string; options: Option[];
  initialSelected?: string[]; limit: number; errors?: string[]; onChange: () => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => [...new Set(initialSelected)]);
  const byId = new Map(options.map(option => [option.id, option]));
  // shortcut: 후보 제목을 모두 전달받아 검색하며, 목록 전송이 느려지면 서버 검색으로 전환한다.
  const matches = options.filter(option => matchesSearch(query, [option.title, option.subtitle, option.id]));
  const current = Math.min(page, Math.max(1, Math.ceil(matches.length / 10)));
  function toggle(value: string) {
    if (selected.includes(value)) setSelected(selected.filter(item => item !== value));
    else if (selected.length < limit) setSelected([...selected, value]);
    else return;
    onChange();
  }
  function search(value: string) { setQuery(value); setPage(1); }
  return <fieldset className="catalog-selection min-w-0 space-y-3 rounded-md border p-4 md:col-span-2" aria-describedby={`${id}-hint${errors.length ? ` ${id}-errors` : ''}`} aria-invalid={errors.length > 0}>
    <legend className="px-1 text-sm font-medium">{label}</legend>
    <p id={`${id}-hint`} className="text-xs leading-6 text-gray-500">{description}</p>
    {/* Keep off-page selections in FormData; visible checkboxes only update selection state. */}
    {selected.map(value => <input key={value} type="hidden" name={name} value={value} />)}
    <div className="space-y-2 rounded-md bg-gray-50 p-3">
      <p className="text-xs font-medium" aria-live="polite">선택한 항목 {selected.length} / {limit}</p>
      {selected.length ? <ul className="space-y-2">{selected.map(value => {
        const title = byId.get(value)?.title || `연결 항목을 찾을 수 없음 · ${value}`;
        return <li key={value} className="flex min-w-0 items-start justify-between gap-3"><span className="min-w-0 break-words text-sm leading-6">{title}</span><button type="button" className="content-table-action shrink-0" aria-label={`${title} 선택 해제`} onClick={() => toggle(value)}>해제</button></li>;
      })}</ul> : <p className="text-xs text-gray-500">아직 선택한 항목이 없습니다.</p>}
    </div>
    <div className="flex min-w-0 items-center gap-2">
      <input id={`${id}-query`} type="search" aria-label={`${label} 검색`} placeholder={placeholder} maxLength={100} value={query} onChange={event => { event.stopPropagation(); search(event.target.value); }} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm" />
      {query && <button type="button" className="content-table-action shrink-0" aria-label={`${label} 검색 초기화`} onClick={() => search('')}>초기화</button>}
    </div>
    <p className="text-xs text-gray-500" aria-live="polite">검색 결과 {matches.length}개 · 전체 {options.length}개{selected.length >= limit ? ' · 선택 한도에 도달했습니다. 다른 항목을 고르려면 먼저 선택을 해제해주세요.' : ''}</p>
    {matches.length ? <div className={name === 'artist_ids' ? 'grid gap-2 sm:grid-cols-2' : 'divide-y rounded-md border'}>{matches.slice((current - 1) * 10, current * 10).map(option => <label key={option.id} className="flex min-h-11 cursor-pointer items-start gap-3 px-3 py-2 text-sm leading-6 hover:bg-gray-50">
      <input type="checkbox" checked={selected.includes(option.id)} disabled={!selected.includes(option.id) && selected.length >= limit} onChange={() => toggle(option.id)} className="mt-1 shrink-0" />
      <span className="min-w-0 break-words">{option.title}{option.subtitle && <span className="block text-xs text-gray-500">{option.subtitle}</span>}</span>
    </label>)}</div> : <p className="rounded-md border p-4 text-sm text-gray-500">검색 결과가 없습니다. 다른 검색어를 입력해주세요.</p>}
    <ContentPagination label={`${label} 검색 결과 페이지`} page={current} totalPages={Math.ceil(matches.length / 10)} onPageChange={setPage} />
    {errors.length > 0 && <div id={`${id}-errors`} role="alert">{errors.map((error, index) => <p key={index} className="text-xs text-red-700">{error}</p>)}</div>}
  </fieldset>;
}
