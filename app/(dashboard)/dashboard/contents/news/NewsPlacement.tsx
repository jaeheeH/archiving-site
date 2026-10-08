'use client';
import { useEffect, useState, type FormEvent } from 'react';
type Placement = { featuredId: string | null; editorPickIds: string[]; posts: { id: string; title: string }[]; writable: boolean };
export default function NewsPlacement() {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open || placement) return;
    const controller = new AbortController();
    fetch('/api/news/placement', { signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setPlacement(data); }).catch(error => { if (!controller.signal.aborted) { setFailed(true); setMessage(error.message); } });
    return () => controller.abort();
  }, [open, placement]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!placement?.writable || busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const response = await fetch('/api/news/placement', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featuredId: data.get('featured') || null, editorPickIds: data.getAll('pick').map(String).filter(Boolean) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || '저장하지 못했습니다.');
      setMessage('대표 기사와 에디터 추천을 저장했습니다.');
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : '저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  return <details onToggle={event => setOpen(event.currentTarget.open)} className="rounded-lg border border-gray-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">대표 기사 · 에디터의 선택</summary>{placement && <form onSubmit={save} className="mt-5 space-y-4"><p className="text-xs text-gray-500">지정하지 않으면 최신 발행 기사로 표시됩니다. 에디터 추천은 최대 3편입니다.</p><fieldset disabled={!placement.writable || busy} className="grid gap-4 lg:grid-cols-2">{['대표 기사', '에디터 추천 1', '에디터 추천 2', '에디터 추천 3'].map((label, index) => <label key={label} className="text-sm">{label}<select name={index === 0 ? 'featured' : 'pick'} defaultValue={(index === 0 ? placement.featuredId : placement.editorPickIds[index - 1]) || ''} className="mt-2 w-full rounded-md border border-gray-200 p-2 text-sm"><option value="">자동 선택</option>{placement.posts.map(post => <option key={post.id} value={post.id}>{post.title}</option>)}</select></label>)}</fieldset>{placement.writable && <button disabled={busy} className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? '저장 중…' : '추천 저장'}</button>}</form>}{message && <p role={failed ? 'alert' : 'status'} className={`mt-3 text-sm ${failed ? 'text-red-700' : 'text-emerald-700'}`}>{message}</p>}</details>;
}
