import { parseArgs } from 'node:util';
import { createAdminClient } from '../lib/supabase/admin.ts';
import { assertNewsProject, collectNewsInto, newsWritingQueue, writePendingNews } from '../lib/news-pipeline.ts';

const { values } = parseArgs({ options: { author: { type: 'string' }, limit: { type: 'string', default: '15' }, 'dry-run': { type: 'boolean' }, 'skip-collect': { type: 'boolean' } } });
const limit = Number(values.limit);
if (!values.author || !/^[0-9a-f-]{36}$/i.test(values.author) || !Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('기존 작성자 계정 --author와 1~25 범위 --limit이 필요합니다.');
assertNewsProject(process.env.NEXT_PUBLIC_SUPABASE_URL);
const db = createAdminClient();
const user = await db.from('users').select('role').eq('id', values.author).single();
if (user.error || !['admin', 'sub-admin', 'editor'].includes(user.data?.role)) throw new Error('ARCH.B 작성자 계정의 권한을 확인해주세요.');
const viewer = { userId: values.author, role: user.data.role };
const before = await newsWritingQueue(db, viewer);
console.log(JSON.stringify({ stage: 'queue', ...before }));
if (!values['dry-run']) {
  if (!process.env.GEMINI_API_KEY) throw new Error('Gemini API 설정이 필요합니다.');
  const collection = values['skip-collect'] ? { results: [] } : await collectNewsInto(db, viewer.userId);
  console.log(JSON.stringify({ stage: 'collection', ...collection }));
  const writing = await writePendingNews(db, viewer, { limit, onProgress: item => console.log(JSON.stringify({ stage: 'writing', ...item })) });
  console.log(JSON.stringify({ stage: 'complete', ...writing }));
  if (writing.failed || collection.results.some(item => item.error)) process.exitCode = 1;
}
