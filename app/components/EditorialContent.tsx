import { Fragment, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';
import { getSiteUrl } from '@/lib/site-url';
import ArchiveImage from './ArchiveImage';
import EditorialGallery from './EditorialGallery';

function imageSize(value: unknown, fallback: number) {
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? Math.max(1, Math.min(10000, Math.round(size))) : fallback;
}

function safeUrl(value: unknown, image = false) {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value, getSiteUrl());
    return (image ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:', 'tel:']).includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

// The public reader renders stored content as HTML; Tiptap stays in the editor.
export default function EditorialContent({ content }: { content: JSONContent | JSONContent[] | string | null }) {
  const nodes = (items?: JSONContent[]): ReactNode => items?.map((node, index) => <Fragment key={index}>{render(node)}</Fragment>);
  const render = (node: JSONContent): ReactNode => {
    const children = nodes(node.content);
    const attrs = node.attrs || {};
    const style = ['left', 'center', 'right', 'justify'].includes(attrs.textAlign) ? { textAlign: attrs.textAlign as 'left' } : undefined;
    switch (node.type) {
      case 'text': return (node.marks || []).reduce<ReactNode>((text, mark, index) => {
        switch (mark.type) {
          case 'bold': return <strong key={index}>{text}</strong>;
          case 'italic': return <em key={index}>{text}</em>;
          case 'strike': return <s key={index}>{text}</s>;
          case 'underline': return <u key={index}>{text}</u>;
          case 'code': return <code key={index}>{text}</code>;
          case 'link': return safeUrl(mark.attrs?.href) ? <a key={index} href={safeUrl(mark.attrs?.href)} rel="noopener noreferrer">{text}</a> : text;
          default: return text;
        }
      }, node.text || '');
      case 'paragraph': return <p style={style}>{children}</p>;
      case 'heading': {
        const Tag = `h${Math.max(2, Math.min(6, Math.trunc(Number(attrs.level)) || 2))}` as 'h2';
        return <Tag style={style}>{children}</Tag>;
      }
      case 'hardBreak': return <br />;
      case 'horizontalRule': return <hr />;
      case 'bulletList': return <ul>{children}</ul>;
      case 'orderedList': return <ol start={Number.isInteger(attrs.start) ? attrs.start : 1}>{children}</ol>;
      case 'listItem': return <li>{children}</li>;
      case 'blockquote': return <blockquote>{children}</blockquote>;
      case 'codeBlock': return <pre><code>{children}</code></pre>;
      case 'image': return safeUrl(attrs.src, true) ? <ArchiveImage src={safeUrl(attrs.src, true)!} width={imageSize(attrs.width, 1200)} height={imageSize(attrs.height, 800)} sizes="(max-width: 1024px) 100vw, 820px" alt={typeof attrs.alt === 'string' ? attrs.alt : ''} title={typeof attrs.title === 'string' ? attrs.title : undefined} loading="lazy" /> : null;
      case 'imageGallery': return <EditorialGallery images={Array.isArray(attrs.images) ? attrs.images.flatMap((url: unknown) => safeUrl(url, true) || []) : []} slider={attrs.layout === 'swiper'} />;
      case 'columns': return <div className={`editorial-columns ${Number(attrs.columns) === 3 ? 'editorial-columns-three' : ''}`}>{children}</div>;
      case 'table': return <table><tbody>{children}</tbody></table>;
      case 'tableRow': return <tr>{children}</tr>;
      case 'tableCell': case 'tableHeader': {
        const Tag = node.type === 'tableHeader' ? 'th' : 'td';
        return <Tag colSpan={Number.isInteger(attrs.colspan) ? Math.max(1, Math.min(100, attrs.colspan)) : 1} rowSpan={Number.isInteger(attrs.rowspan) ? Math.max(1, Math.min(100, attrs.rowspan)) : 1}>{children}</Tag>;
      }
      default: return children;
    }
  };
  return <div className="tiptap ProseMirror">{typeof content === 'string' ? <p>{content}</p> : Array.isArray(content) ? nodes(content) : content ? render(content) : null}</div>;
}
