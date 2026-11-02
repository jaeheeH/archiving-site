'use client';

import { useEffect, useState } from 'react';

export default function CodeCopyButton({ code }: { code: string }) {
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  useEffect(() => {
    if (state !== 'copied') return;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  return <div className="news-code-copy">
    <button type="button" disabled={state === 'copying'} onClick={async () => {
      setState('copying');
      try { await navigator.clipboard.writeText(code); setState('copied'); }
      catch { setState('error'); }
    }}>{state === 'copied' ? '복사됨' : state === 'copying' ? '복사 중…' : '코드 복사'}</button>
    <span role="status">{state === 'error' ? '복사하지 못했습니다. 아래 코드를 직접 선택해 복사해주세요.' : state === 'copied' ? '코드를 복사했습니다.' : ''}</span>
  </div>;
}
