import { z } from 'zod';
import type { Resource } from './resource';
export const curationSchema = z.object({
  title:z.string().trim().min(8).max(120), summary:z.string().trim().min(80).max(450),
  items:z.array(z.object({ key:z.string().max(150), reason:z.string().trim().min(50).max(220) }).strict()).length(6),
  closing:z.string().trim().min(30).max(300),
}).strict();
export type CurationDraft = z.infer<typeof curationSchema>;
export function validateCuration(value: unknown, candidates: Resource[]) {
  const parsed=curationSchema.safeParse(value);
  if (!parsed.success) throw new Error('AI 초안의 제목·소개·자료 설명이 정해진 형식에 맞지 않습니다. 다시 작성해주세요.');
  const draft=parsed.data;
  const keys = new Set(draft.items.map(item => item.key));
  if (keys.size !== draft.items.length) throw new Error('큐레이션 자료가 중복됩니다.');
  const selected = draft.items.map(item => {
    const resource = candidates.find(candidate => `${candidate.type}:${candidate.id}` === item.key);
    if (!resource) throw new Error('실제 공개 자료를 확인하지 못했습니다.');
    if (!/^\/(?!\/)/.test(resource.url)) {
      let url; try { url=new URL(resource.url); } catch { throw new Error('자료 링크를 확인해주세요.'); }
      if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('자료 링크를 확인해주세요.');
    }
    return resource;
  });
  if (new Set(selected.map(item => item.type)).size < 2) throw new Error('최소 두 종류의 자료를 연결해주세요.');
  if (!/[가-힣]/.test(draft.title + draft.summary)) throw new Error('한국어 큐레이션을 작성해주세요.');
  return { draft, selected };
}
export function curationDocument(draft: CurationDraft, selected: Resource[]) {
  const paragraph = (text: string) => ({ type:'paragraph',content:[{type:'text',text}] });
  return { type:'doc',content:[paragraph(draft.summary), ...draft.items.flatMap((item,index) => [
    {type:'heading',attrs:{level:2},content:[{type:'text',text:selected[index].title,marks:[{type:'link',attrs:{href:selected[index].url}}]}]},
    paragraph(item.reason),
    paragraph(`자료: ${selected[index].source}`),
  ]), paragraph(draft.closing)] };
}
