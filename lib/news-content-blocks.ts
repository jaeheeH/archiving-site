import { z } from 'zod';

export const uploadedNewsImageUrl = z.string().trim().max(2000).url().refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'overgjynkrnwayfammid.supabase.co'
      && !url.username && !url.password && !url.port && url.pathname.startsWith('/storage/v1/object/public/posts/');
  } catch { return false; }
}, '업로드한 뉴스 이미지 주소가 필요합니다.');

const position = { afterSection: z.number().int().min(0).max(11) };
const title = z.string().trim().max(120);
const caption = z.string().trim().max(500).optional();
export const draftNewsContentBlockSchema = z.discriminatedUnion('type', [
  z.object({ ...position, type: z.literal('image'), src: z.union([z.literal(''), uploadedNewsImageUrl]),
    alt: z.string().trim().max(200), caption, credit: z.string().trim().max(200),
    width: z.number().int().min(1).max(20000), height: z.number().int().min(1).max(20000) }).strict(),
  z.object({ ...position, type: z.literal('table'), title, caption,
    columns: z.array(z.string().trim().max(100)).min(1).max(8),
    rows: z.array(z.array(z.string().trim().max(300)).max(8)).max(40) }).strict(),
  z.object({ ...position, type: z.literal('code'), title,
    language: z.enum(['html', 'css', 'javascript', 'typescript', 'json', 'text']), code: z.string().max(16000) }).strict(),
]);

export const newsContentBlockSchema = draftNewsContentBlockSchema.superRefine((block, context) => {
  const issue = (field: string, message: string) => context.addIssue({ code: 'custom', path: [field], message });
  if (block.type === 'image') {
    if (!block.src) issue('src', '본문 이미지를 업로드해주세요.');
    if (!block.alt) issue('alt', '이미지의 내용을 설명해주세요.');
    if (!block.credit) issue('credit', '이미지 출처·크레딧을 적어주세요.');
  } else if (block.type === 'table') {
    if (!block.title) issue('title', '표 제목을 적어주세요.');
    if (block.columns.some(column => !column)) issue('columns', '각 열의 제목을 적어주세요.');
    if (!block.rows.length || block.rows.some(row => row.length !== block.columns.length || row.every(cell => !cell))) {
      issue('rows', '표의 각 행을 제목과 같은 열 수로 채워주세요.');
    }
  } else {
    if (!block.title) issue('title', '코드 제목을 적어주세요.');
    if (!block.code.trim()) issue('code', '표시할 코드를 입력해주세요.');
  }
});

export type NewsContentBlock = z.infer<typeof newsContentBlockSchema>;
