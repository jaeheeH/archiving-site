// app/api/images/delete/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getErrorMessage } from '@/lib/error-message';
import { isSafeIdentifierParam } from '@/lib/route-params';

function isSafeGeneratedImagePath(value: string) {
  return (
    value.length <= 512 &&
    !value.startsWith('/') &&
    !value.includes('..') &&
    /^[a-zA-Z0-9._/-]+$/.test(value)
  );
}

function extractGeneratedImageStoragePath(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    const marker = '/storage/v1/object/public/generated-images/';
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex < 0) return null;

    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    const fallbackPath = imageUrl
      .split('/generated-images/')
      .pop()
      ?.split('?')[0]
      ?.split('#')[0];

    return fallbackPath || null;
  }
}

function isStorageNotFoundError(error: unknown) {
  const storageError = error as { status?: number | string; statusCode?: number | string; message?: string };
  const status = Number(storageError.statusCode ?? storageError.status ?? 0);

  return status === 404 || /not found/i.test(storageError.message || '');
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      const parsed = await request.json();
      body = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 });
    }

    const id = typeof body.id === 'string' && isSafeIdentifierParam(body.id)
      ? body.id
      : '';
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: '이미지 ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: image, error: imageError } = await supabase
      .from('generated_images')
      .select('id, image_url, user_id')
      .eq('id', id)
      .maybeSingle();

    if (imageError) throw imageError;

    if (!image) {
      return NextResponse.json({ error: '이미지를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (image.user_id !== user.id) {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    const storagePath = extractGeneratedImageStoragePath(image.image_url);
    let storageDeleted = false;
    let storageSkipped = false;

    if (storagePath) {
      if (!isSafeGeneratedImagePath(storagePath)) {
        return NextResponse.json(
          { error: '이미지 Storage 경로가 올바르지 않아 삭제를 중단했습니다.' },
          { status: 400 }
        );
      }

      const { error: storageError } = await supabase.storage
        .from('generated-images')
        .remove([storagePath]);

      if (storageError && !isStorageNotFoundError(storageError)) {
        console.error('Storage Delete Error:', storageError);
        return NextResponse.json(
          { error: 'Storage 파일 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.' },
          { status: 502 }
        );
      }

      storageDeleted = !storageError;
    } else {
      storageSkipped = true;
    }

    const { error: dbError } = await supabase
      .from('generated_images')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, storageDeleted, storageSkipped });

  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
