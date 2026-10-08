'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';

export function NewsSources({ sources }: { sources: readonly string[] }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const counts = new Map<string, number>();
  for (const source of sources) counts.set(source, (counts.get(source) || 0) + 1);
  const entries = [...counts];
  const links = (items: typeof entries) => items.map(([source, count]) => (
    <Link prefetch={false} className="news-source-link" href={`/news/stories?source=${encodeURIComponent(source)}`} key={source}>
      <span>{source}</span><small>{count}편</small>
    </Link>
  ));

  return <section className="news-sources">
    <h2>함께 읽는 매체</h2>
    <div id={listId}>{links(entries.slice(0, expanded ? entries.length : 6))}</div>
    {entries.length > 6 && <button className="news-sources-toggle" type="button" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>
        <span>{expanded ? '접기' : <>더보기 <small>+{entries.length - 6}</small></>}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>}
  </section>;
}
