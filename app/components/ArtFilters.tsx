'use client';

import { useEffect, useRef, useState, useTransition, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ART_PERIODS, ART_MOVEMENTS, ART_KINDS, ART_SUBJECTS, readArtFilters, type ArtFilters as Filters } from '@/lib/art-taxonomy';

export default function ArtFilters({ action, filters, options, artists = [], museums = [], forArtists = false }: {
  action: string;
  filters: Filters;
  options: { periods: string[]; movements: string[]; kinds: string[]; subjects: string[] };
  artists?: { id: string; label: string }[];
  museums?: string[];
  forArtists?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (!(event.target instanceof Node)) return;
      for (const menu of formRef.current?.querySelectorAll<HTMLDetailsElement>('details[open]') || []) {
        if (!menu.contains(event.target)) menu.open = false;
      }
    };
    document.addEventListener('click', dismiss);
    document.addEventListener('focusin', dismiss);
    return () => {
      document.removeEventListener('click', dismiss);
      document.removeEventListener('focusin', dismiss);
    };
  }, []);
  const [selected, setSelected] = useState(filters);
  const [appliedFilters, setAppliedFilters] = useState(filters);
  if (appliedFilters !== filters) {
    setAppliedFilters(filters);
    setSelected(filters);
  }
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState({ submitted: filters.q, draft: filters.q });
  if (query.submitted !== filters.q) setQuery({ submitted: filters.q, draft: filters.q });
  const { period } = selected;
  const movements = ART_MOVEMENTS.filter(item => options.movements.includes(item.id) && (!period || item.periods.some(value => value === period)));
  const groups = [
    { name: 'period', label: '시대', all: '모든 시대', items: ART_PERIODS.filter(item => options.periods.includes(item.id)), values: selected.period ? [selected.period] : [] },
    { name: 'movement', label: '사조·양식', all: '모든 사조·양식', items: movements, values: selected.movement ? [selected.movement] : [] },
    { name: 'kind', label: '작품 종류', all: '모든 종류', items: ART_KINDS.filter(item => options.kinds.includes(item.id)), values: selected.kind ? [selected.kind] : [] },
    { name: 'subject', label: '주제', all: '모든 주제', items: ART_SUBJECTS.filter(item => options.subjects.includes(item.id)), values: selected.subjects },
    ...(artists.length ? [{ name: 'artist', label: '작가', all: '모든 작가', items: artists, values: selected.artist ? [selected.artist] : [] }] : []),
    ...(museums.length ? [{ name: 'museum', label: '소장처', all: '모든 소장처', items: museums.map(museum => ({ id: museum, label: museum })), values: selected.museum ? [selected.museum] : [] }] : []),
  ];
  const apply = (data: FormData, clearMovement = false, submitSearch = false) => {
    if (clearMovement) data.set('movement', '');
    if (!submitSearch) data.set('q', selected.q);
    const params = new URLSearchParams();
    for (const [name, value] of data) {
      if (typeof value === 'string' && value.trim()) params.append(name, value.trim());
    }
    const next = readArtFilters({ ...Object.fromEntries(params), subject: params.getAll('subject') });
    setSelected(next);
    startTransition(() => router.push(`${action}${params.size ? `?${params}` : ''}`, { scroll: false }));
  };
  const onFilterChange = (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const field = event.currentTarget;
    if (field.form) apply(new FormData(field.form), field.name === 'period');
  };
  const remove = (name: string, value?: string) => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const keep = value ? data.getAll(name).filter(item => item !== value) : [];
    data.delete(name);
    for (const item of keep) data.append(name, item);
    apply(data, name === 'period');
  };
  return <form ref={formRef} action={action} method="get" className="archive-filter" aria-label={forArtists ? '작가 필터' : '작품 필터'} aria-busy={pending}
    onSubmit={event => { event.preventDefault(); apply(new FormData(event.currentTarget), false, true); }}
    onKeyDown={event => {
      if (event.key !== 'Escape') return;
      const menu = event.currentTarget.querySelector<HTMLDetailsElement>('details[open]');
      if (menu) { event.preventDefault(); menu.open = false; menu.querySelector('summary')?.focus(); }
    }}>
    <div className="archive-filter-search">
      <label className="sr-only" htmlFor="archive-query">{forArtists ? '작가 검색' : '작품 검색'}</label>
      <input id="archive-query" type="search" name="q" value={query.draft} onChange={event => setQuery({ ...query, draft: event.target.value })} maxLength={100} placeholder={forArtists ? '작가 이름·소개·분류 검색' : '제목·작가·재료·태그 검색'} />
      <button type="submit" className="archive-button">검색</button>
    </div>
    <div className="archive-filter-fields">
      {groups.map(group => <details key={group.name} name="archive-filter-groups" className="archive-filter-group" data-filter={group.name}>
        <summary aria-label={`${group.label} 필터${group.values.length ? ` · ${group.values.length}개 선택` : ''}`}>
          <span>{group.label}</span>{group.values.length > 0 && <span className="archive-filter-count" aria-hidden="true">{group.values.length}</span>}<i className="ri-arrow-down-s-line" aria-hidden="true" />
        </summary>
        <fieldset className="archive-filter-panel">
          <legend className="sr-only">{group.label}</legend>
          {group.name === 'subject' && <p>여러 개 선택 · 선택한 주제 중 하나를 포함한 작품</p>}
          {group.name === 'subject'
            ? <button type="button" className="archive-filter-all" onClick={() => remove(group.name)}>{group.all}</button>
            : <label><span>{group.all}</span><input type="radio" name={group.name} value="" checked={!group.values.length} onChange={onFilterChange} /></label>}
          {group.items.map(item => <label key={item.id}><span>{item.label}</span><input type={group.name === 'subject' ? 'checkbox' : 'radio'} name={group.name} value={item.id} checked={group.values.includes(item.id)} onChange={onFilterChange} /></label>)}
          {group.name === 'movement' && !group.items.length && <p>이 시대에서 확인한 사조가 없습니다.</p>}
        </fieldset>
      </details>)}
    </div>
    {groups.some(group => group.values.length) && <div className="archive-filter-selected" aria-label="선택한 필터">
      {groups.flatMap(group => group.values.map(value => <button key={`${group.name}-${value}`} type="button" aria-label={`${group.label} · ${group.items.find(item => item.id === value)?.label || value} 해제`} onClick={() => remove(group.name, value)}>
        <span>{group.label} · {group.items.find(item => item.id === value)?.label || value}</span><i className="ri-close-line" aria-hidden="true" />
      </button>))}
    </div>}
    <p role="status" className="sr-only">{pending ? '결과를 업데이트하고 있습니다.' : ''}</p>
    {forArtists && <p className="archive-filter-hint">현재 수집한 작품 중 선택한 조건에 맞는 작품이 있는 작가를 보여줍니다.</p>}
  </form>;
}
