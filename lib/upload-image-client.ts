'use client';
import { createClient } from '@/lib/supabase/client';

export async function uploadImageFile(endpoint: string, form: FormData) {
  const file = form.get('file');
  if (!(file instanceof File) || file.size <= 4 * 1024 * 1024) return fetch(endpoint, { method: 'POST', body: form });
  const fields = Object.fromEntries([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  const prepare = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'prepare', type: file.type, size: file.size }) });
  if (!prepare.ok) return prepare;
  const { upload } = await prepare.json();
  const { error } = await createClient().storage.from(upload.bucket).uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) throw new Error('원본 이미지 전송에 실패했습니다. 다시 시도해주세요.');
  return fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'complete', path: upload.path, name: file.name, fields }) });
}
