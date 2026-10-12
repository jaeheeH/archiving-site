'use client';
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import type { NewsJob } from '@/lib/news-jobs';
export default function CurationControls({ onComplete }: { onComplete:()=>void }) {
  const dialog=useRef<HTMLDialogElement>(null);
  const latestComplete=useRef(onComplete);
  const completed=useRef<string | null>(null);
  const [open,setOpen]=useState(false);
  const [topic,setTopic]=useState('');
  const [job,setJob]=useState<NewsJob | null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const active=!!job && ['queued','collecting','writing'].includes(job.status);
  useEffect(() => { latestComplete.current=onComplete; },[onComplete]);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); },[open]);
  useEffect(() => {
    let alive=true;
    const refresh=async () => {
      if (document.hidden) return;
      try {
        const res=await fetch('/api/curations/draft',{cache:'no-store'});
        const data=await res.json();
        if (!alive || !res.ok) return;
        setJob(data.job);
        if (data.job?.status === 'completed' && completed.current !== data.job.id) { completed.current=data.job.id; latestComplete.current(); }
      } catch { /* The stored server job keeps running; refresh on the next poll. */ }
    };
    void refresh();
    const timer=setInterval(() => void refresh(),15000);
    const visible=() => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange',visible);
    return () => { alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible); };
  },[]);
  const create=async (retry=false) => {
    if (busy || active) return;
    setBusy(true);setError('');
    try {
      const res=await fetch('/api/curations/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(retry ? {retryId:job?.id} : {topic})});
      const data=await res.json();
      if (!res.ok) throw new Error(data.error || '초안을 요청하지 못했습니다.');
      setJob(data.job);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '초안을 요청하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" className="content-table-action" onClick={() => setOpen(true)}>AI 큐레이션 초안</button>
    {active && <span role="status" className="text-xs text-muted-foreground">큐레이션 작성 중</span>}
    <dialog ref={dialog} aria-labelledby="curation-title" aria-describedby="curation-description" onClose={() => setOpen(false)} className="fixed left-1/2 top-1/2 m-0 max-h-[85svh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/50">
      <div className="flex items-center justify-between gap-4"><h2 id="curation-title" className="text-lg font-semibold">AI 큐레이션 초안</h2><button type="button" aria-label="닫기" onClick={() => setOpen(false)} className="content-table-action">닫기</button></div>
      <p id="curation-description" className="mt-3 text-sm leading-6 text-muted-foreground">공개된 자료 6개를 주제로 연결합니다. AI 초안은 미발행 에디토리얼로 저장되며, 검토 후 직접 발행합니다. 창을 닫아도 서버가 계속 작성합니다.</p>
      <form onSubmit={event => {event.preventDefault();void create();}} className="mt-5 space-y-4">
        <label htmlFor="curation-topic" className="block text-sm font-semibold">주제 · 비워두면 AI가 제안합니다</label>
        <input id="curation-topic" value={topic} onChange={event => setTopic(event.target.value)} maxLength={100} disabled={active || busy} className="w-full rounded border border-border bg-background p-3 text-sm" placeholder="예: 빛과 공간" />
        <div className="flex flex-wrap gap-2">{['빛과 공간','만드는 사람의 AI 도구'].map(value => <button type="button" className="content-table-action" key={value} onClick={() => setTopic(value)} disabled={active || busy}>{value}</button>)}</div>
        <button className="content-table-create" disabled={active || busy}>{active ? '작성 중' : busy ? '요청 중' : '초안 생성'}</button>
      </form>
      {job && <div className="mt-5 border-t border-border pt-4 text-sm" aria-live="polite"><p>{active ? '서버에서 자료를 선정하고 초안을 검토하고 있습니다.' : job.status === 'completed' ? '초안 생성 완료' : '초안 생성 실패'}</p>{job.status === 'completed' && job.draftId && <Link className="mt-3 inline-block underline underline-offset-4" href={`/dashboard/contents/blog/${job.draftId}/edit`}>초안 검토·수정 →</Link>}{job.status === 'failed' && <><p className="my-3 text-destructive">{job.error}</p><button type="button" className="content-table-action" disabled={busy} onClick={() => void create(true)}>다시 작성</button></>}</div>}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    </dialog>
  </>;
}
