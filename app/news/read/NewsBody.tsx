import { ExternalLink } from 'lucide-react';
import { Fragment } from 'react';
import { editorialReferences } from '@/lib/news-editorial';
import type { NewsArticle } from '@/lib/news-record';

export function NewsBody({ news }: { news: NewsArticle }) {
  const sources = editorialReferences(news.url, news.original_title, news.paragraphs);
  return <div className="reading-body">
    {news.paragraphs.map((section, index) => typeof section === 'string' ? <p key={index}>{section}</p> : <Fragment key={index}>
      {section.heading && <h2>{section.heading}</h2>}
      {section.paragraphs.map((text, paragraphIndex) => <p key={paragraphIndex}>{text}</p>)}
    </Fragment>)}
    <div className="reading-tags">{news.tags.map(tag => <a href={`/news/stories?q=${encodeURIComponent(tag)}`} key={tag}>{tag}</a>)}</div>
    <section className="source-credit" aria-labelledby="news-sources-title">
      <h2 id="news-sources-title">출처와 참고자료</h2>
      <ul className="news-source-list">
        {sources.map(source => <li key={source.url}>
          <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<ExternalLink size={14} /><span className="sr-only"> (새 창)</span></a>
          <p className="news-source-meta">{source.kind === 'primary' ? '공식 1차 자료' : source.url === news.url ? '원출처 기사' : '보도·참고자료'} · {source.url.replace(/^https?:\/\/(?:www\.)?/, '').split('/')[0]}</p>
        </li>)}
      </ul>
    </section>
  </div>;
}
