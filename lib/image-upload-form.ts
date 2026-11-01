import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Large originals go straight to Storage, avoiding the hosting request-body limit. */
export async function imageUploadForm(request: Request, client: Pick<SupabaseClient, 'storage'>, bucket: string, userId: string) {
  if (!request.headers.get('content-type')?.includes('application/json')) return request.formData();
  const fail = (message: string) => Response.json({ error: message }, { status: 400 });
  let body;
  try { body = await request.json(); } catch { return fail('올바른 업로드 요청이 필요합니다.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('올바른 업로드 요청이 필요합니다.');
  if (body.stage === 'prepare') {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(body.type)
      || !Number.isSafeInteger(body.size) || body.size <= 0 || body.size > 8 * 1024 * 1024) return fail('이미지는 8MB 이하의 JPG, PNG, WebP, GIF 파일이어야 합니다.');
    const extension = body.type === 'image/jpeg' ? 'jpg' : body.type.slice(6);
    const path = `direct/${userId}/${randomUUID()}.${extension}`;
    const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path, { upsert: false });
    if (error || !data) throw error || new Error('업로드 주소를 만들지 못했습니다.');
    return Response.json({ upload: { bucket, path, token: data.token } }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  if (body.stage !== 'complete' || typeof body.path !== 'string'
    || !body.path.startsWith(`direct/${userId}/`) || !/^direct\/[a-zA-Z0-9_-]+\/[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(body.path)) return fail('올바르지 않은 원본 이미지 경로입니다.');
  const { data, error } = await client.storage.from(bucket).download(body.path);
  if (error || !data) throw error || new Error('업로드된 원본을 찾지 못했습니다.');
  if (data.size > 8 * 1024 * 1024) return fail('이미지는 8MB 이하로 업로드해주세요.');
  const form = new FormData();
  for (const [key, value] of Object.entries(body.fields || {})) if (key !== 'file' && typeof value === 'string') form.set(key, value);
  form.set('file', new File([data], typeof body.name === 'string' ? body.name.slice(0, 200) : 'image', { type: data.type }));
  // Retain the direct-upload copy as a backup. The route stores the permanent
  // original and derivatives before returning its usual response shape.
  return form;
}
