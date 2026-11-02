import ArchiveImage from '@/app/components/ArchiveImage';
import { newsContentBlockSchema, type NewsContentBlock } from '@/lib/news-content-blocks';
import CodeCopyButton from './CodeCopyButton';

export default function NewsContentBlocks({ blocks }: { blocks: NewsContentBlock[] }) {
  return blocks.map((value, index) => {
    const parsed = newsContentBlockSchema.safeParse(value);
    if (!parsed.success) return null;
    const block = parsed.data;
    if (block.type === 'image') return <figure key={index} className="news-content-image">
      <ArchiveImage src={block.src} alt={block.alt} width={block.width} height={block.height} sizes="(min-width: 1024px) 800px, 100vw" />
      <figcaption>{block.caption && <span>{block.caption}</span>}<span className="news-content-credit">{block.credit}</span></figcaption>
    </figure>;
    if (block.type === 'table') return <figure key={index} className="news-content-table">
      <figcaption><strong>{block.title}</strong>{block.caption && <span>{block.caption}</span>}</figcaption>
      <div className="news-table-scroll" role="region" aria-label={`${block.title} 표, 좁은 화면에서 좌우로 스크롤`} tabIndex={0}>
        <table style={{ minWidth: Math.max(320, block.columns.length * 100) }}>
          <caption className="sr-only">{block.title}</caption>
          <thead><tr>{block.columns.map((column, cell) => <th scope="col" key={cell}>{column}</th>)}</tr></thead>
          <tbody>{block.rows.map((row, line) => <tr key={line}>{row.map((cell, column) => column === 0 ? <th scope="row" key={column}>{cell}</th> : <td key={column}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <span className="news-table-hint">표를 좌우로 넘겨 전체 내용을 확인할 수 있습니다.</span>
    </figure>;
    return <details key={index} className="news-content-code">
      <summary>{block.title}<span>{block.language.toUpperCase()}</span></summary>
      <CodeCopyButton code={block.code} />
      <pre tabIndex={0} aria-label={`${block.title} 코드`}><code>{block.code}</code></pre>
    </details>;
  });
}
