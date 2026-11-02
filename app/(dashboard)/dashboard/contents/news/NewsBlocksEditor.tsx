'use client';

import ArchiveImage from '@/app/components/ArchiveImage';
import type { NewsContentBlock } from '@/lib/news-content-blocks';

type Props = {
  blocks: NewsContentBlock[]; afterSection: number; disabled: boolean;
  onChange: (blocks: NewsContentBlock[]) => void;
  uploadImage: (file: File) => Promise<{ src: string; width: number; height: number } | null>;
};
const field = 'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-6';
const names = { image: '이미지', table: '표', code: '코드' };

export default function NewsBlocksEditor({ blocks, afterSection, disabled, onChange, uploadImage }: Props) {
  const update = (index: number, block: NewsContentBlock) => onChange(blocks.map((value, i) => i === index ? block : value));
  function add(type: NewsContentBlock['type']) {
    const block: NewsContentBlock = type === 'image'
      ? { type, afterSection, src: '', alt: '', credit: '', width: 1200, height: 800 }
      : type === 'table'
        ? { type, afterSection, title: '비교표', columns: ['항목', '내용'], rows: [['', '']] }
        : { type, afterSection, title: '참고 코드', language: 'html', code: '' };
    onChange([...blocks, block]);
  }
  return <div className="space-y-4 border-t border-border pt-4">
    <div><h3 className="text-sm font-semibold">이 섹션 다음에 넣기</h3><p className="mt-1 text-xs text-muted-foreground">이미지·표·코드는 글 다음에 표시됩니다. 섹션마다 최대 4개를 넣을 수 있습니다.</p></div>
    {blocks.map((block, index) => <fieldset key={index} disabled={disabled} className="min-w-0 space-y-3 border border-border p-3">
      <legend className="px-1 text-xs font-semibold">{names[block.type]} {index + 1}</legend>
      {block.type === 'image' ? <>
        {block.src && <ArchiveImage src={block.src} alt={block.alt || '업로드한 본문 이미지 미리보기'} width={block.width} height={block.height} sizes="600px" className="max-h-64 w-full object-contain" />}
        <label className="block text-sm">본문 이미지 업로드<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-2 block w-full text-xs" onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = '';
          if (!file) return;
          const image = await uploadImage(file);
          if (image) update(index, { ...block, ...image });
        }} /></label>
        <p className="text-xs text-muted-foreground">JPG·PNG·WebP·GIF, 8MB 이하. 저장하면 본문에 반영됩니다.</p>
        <label className="block text-sm">이미지 설명 (필수)<input value={block.alt} maxLength={200} className={field} onChange={event => update(index, { ...block, alt: event.target.value })} placeholder="이미지를 보지 않고도 내용을 알 수 있게 적어주세요." /></label>
        <label className="block text-sm">이미지 아래 설명<textarea value={block.caption || ''} maxLength={500} rows={2} className={field} onChange={event => update(index, { ...block, caption: event.target.value })} /></label>
        <label className="block text-sm">이미지 출처·크레딧 (필수)<input value={block.credit} maxLength={200} className={field} onChange={event => update(index, { ...block, credit: event.target.value })} placeholder="예: ARCH.B 직접 제작·캡처" /></label>
      </> : block.type === 'table' ? <>
        <label className="block text-sm">표 제목<input value={block.title} maxLength={120} className={field} onChange={event => update(index, { ...block, title: event.target.value })} /></label>
        <label className="block text-sm">표 설명<input value={block.caption || ''} maxLength={500} className={field} onChange={event => update(index, { ...block, caption: event.target.value })} /></label>
        <label className="block text-sm">표 데이터<textarea className={`${field} font-mono`} rows={7} wrap="off" value={[block.columns, ...block.rows].map(row => row.join('\t')).join('\n')} onChange={event => {
          const [columns, ...rows] = event.target.value.split(/\r?\n/).map(row => row.split('\t'));
          update(index, { ...block, columns, rows });
        }} /></label>
        <p className="text-xs leading-5 text-muted-foreground">첫 줄은 열 제목입니다. 열은 탭, 행은 줄바꿈으로 구분하세요. 스프레드시트에서 복사해 붙여넣을 수 있습니다. 최대 8열·40행.</p>
      </> : <>
        <label className="block text-sm">코드 제목<input value={block.title} maxLength={120} className={field} onChange={event => update(index, { ...block, title: event.target.value })} /></label>
        <label className="block text-sm">코드 언어<select className={field} value={block.language} onChange={event => update(index, { ...block, language: event.target.value as typeof block.language })}>{['html', 'css', 'javascript', 'typescript', 'json', 'text'].map(language => <option key={language} value={language}>{language.toUpperCase()}</option>)}</select></label>
        <label className="block text-sm">코드 내용<textarea value={block.code} maxLength={16000} rows={10} wrap="off" spellCheck={false} className={`${field} font-mono`} onChange={event => update(index, { ...block, code: event.target.value })} /></label>
        <p className="text-xs text-muted-foreground">접이식 영역에 표시하며, 독자가 복사할 수 있습니다. 입력한 코드는 실행하지 않습니다.</p>
      </>}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button type="button" disabled={index === 0 || disabled} className="content-table-action disabled:opacity-40" aria-label={`${names[block.type]} ${index + 1} 위로 이동`} onClick={() => { const next = [...blocks]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }}>위로</button>
        <button type="button" disabled={index === blocks.length - 1 || disabled} className="content-table-action disabled:opacity-40" aria-label={`${names[block.type]} ${index + 1} 아래로 이동`} onClick={() => { const next = [...blocks]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; onChange(next); }}>아래로</button>
        <button type="button" disabled={disabled} className="ml-auto px-2 py-2 text-red-600" aria-label={`${names[block.type]} ${index + 1} 제거`} onClick={() => onChange(blocks.filter((_, i) => i !== index))}>제거</button>
      </div>
    </fieldset>)}
    <div className="flex flex-wrap gap-2">{(['image', 'table', 'code'] as const).map(type => <button type="button" key={type} disabled={disabled || blocks.length >= 4} className="content-table-action disabled:opacity-40" onClick={() => add(type)}>+ {names[type]} 추가</button>)}</div>
  </div>;
}
