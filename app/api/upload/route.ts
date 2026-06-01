import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkPostEditPermission } from '@/lib/supabase/post-utils';
import { getErrorMessage } from '@/lib/error-message';

const MAX_UPLOAD_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function normalizeFolder(folder: FormDataEntryValue | null) {
  if (typeof folder !== 'string') return '';

  return folder
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/^posts\/?/, '')
    .split('/')
    .filter((part) => /^[a-zA-Z0-9_-]+$/.test(part))
    .join('/');
}

function toSafeFileName(fileName: string) {
  const baseName = fileName.replace(/\\/g, '/').split('/').pop() || '';
  return baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getFileNameFromForm(formData: FormData) {
  const explicitFileName = formData.get('fileName');
  if (typeof explicitFileName === 'string' && explicitFileName.trim()) {
    return toSafeFileName(explicitFileName);
  }

  const legacyPath = formData.get('path');
  if (typeof legacyPath === 'string' && legacyPath.trim()) {
    return toSafeFileName(legacyPath);
  }

  return '';
}

export async function POST(request: NextRequest) {
  try {
    const permCheck = await checkPostEditPermission();
    if (!permCheck.authorized) return permCheck.error;

    const formData = await request.formData();
    const file = formData.get('file');
    const fileName = getFileNameFromForm(formData);
    const explicitFolder = normalizeFolder(formData.get('folder'));
    const legacyPath = formData.get('path');
    const legacyFolder =
      typeof legacyPath === 'string'
        ? normalizeFolder(legacyPath.replace(/\\/g, '/').replace(/\/?[^/]*$/, ''))
        : '';
    const folder = explicitFolder || legacyFolder;
    const isTemp = formData.get('isTemp') === 'true'; // temp 폴더 사용 여부

    if (!(file instanceof File) || !fileName) {
      return NextResponse.json(
        { error: '파일과 파일명이 필요합니다' },
        { status: 400 }
      );
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'JPG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다' },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: '이미지는 8MB 이하로 업로드해주세요' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // temp 폴더면 user_id별로 (없으면 'anonymous'), 아니면 일반 폴더에 저장
    const userId = permCheck.userId;
    const pathSegments = isTemp
      ? ['temp', userId, folder, fileName]
      : [folder, fileName];
    const filePath = pathSegments.filter(Boolean).join('/');

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('posts')
      .upload(filePath, buffer, {
        cacheControl: '31536000',
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase 업로드 에러:', uploadError);
      return NextResponse.json(
        { error: '이미지 업로드 실패' },
        { status: 400 }
      );
    }

    const { data } = supabase.storage.from('posts').getPublicUrl(filePath);

    return NextResponse.json(
      { url: data.publicUrl },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('API 에러:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, '서버 오류') },
      { status: 500 }
    );
  }
}
