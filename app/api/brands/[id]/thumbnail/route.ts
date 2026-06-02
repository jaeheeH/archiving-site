import { NextRequest, NextResponse } from 'next/server';
import { getBrandManagerContext } from '@/lib/brand-manager-auth';
import { getErrorMessage } from '@/lib/error-message';
import { isSafeIdentifierParam } from '@/lib/route-params';

interface Props {
  params: Promise<{ id: string }>;
}

const MAX_THUMBNAIL_BYTES = 12 * 1024 * 1024;
const THUMBNAIL_FOLDER = '__thumbnail__';

function getImageExtension(contentType: string) {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  return 'jpg';
}

function isSelectedThumbnailFile(name: string) {
  return /^selected(?:-[a-zA-Z0-9_-]+)?\.(jpe?g|png|webp)$/i.test(name);
}

async function parseJsonObject(request: NextRequest) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function getAuthorizedContext(brandId: string) {
  const context = await getBrandManagerContext();
  if (context.response) return context;

  const { data: brand, error } = await context.admin
    .from('brands')
    .select('id, user_id')
    .eq('id', brandId)
    .eq('user_id', context.user.id)
    .maybeSingle();

  if (error) throw error;

  if (!brand) {
    return {
      response: NextResponse.json({ error: '브랜드를 찾을 수 없습니다.' }, { status: 404 }),
    };
  }

  return context;
}

export async function GET(_request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const brandId = isSafeIdentifierParam(id) ? id : '';

    if (!brandId) {
      return NextResponse.json({ error: 'Invalid brand id' }, { status: 400 });
    }

    const context = await getAuthorizedContext(brandId);
    if (context.response) return context.response;

    const { data, error } = await context.admin
      .from('generated_images')
      .select('id, image_url, prompt, created_at')
      .eq('brand_id', brandId)
      .eq('user_id', context.user.id)
      .order('created_at', { ascending: false })
      .limit(36);

    if (error) throw error;

    return NextResponse.json(
      { images: data || [] },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const brandId = isSafeIdentifierParam(id) ? id : '';

    if (!brandId) {
      return NextResponse.json({ error: 'Invalid brand id' }, { status: 400 });
    }

    const body = await parseJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 });
    }

    const imageId =
      typeof body.imageId === 'string' && isSafeIdentifierParam(body.imageId, 100)
        ? body.imageId
        : '';

    if (!imageId) {
      return NextResponse.json({ error: '이미지 ID가 필요합니다.' }, { status: 400 });
    }

    const context = await getAuthorizedContext(brandId);
    if (context.response) return context.response;

    const { data: image, error: imageError } = await context.admin
      .from('generated_images')
      .select('id, image_url, brand_id, user_id')
      .eq('id', imageId)
      .eq('brand_id', brandId)
      .eq('user_id', context.user.id)
      .maybeSingle();

    if (imageError) throw imageError;

    if (!image?.image_url) {
      return NextResponse.json({ error: '선택할 이미지를 찾을 수 없습니다.' }, { status: 404 });
    }

    const imageResponse = await fetch(image.image_url, { signal: AbortSignal.timeout(30_000) });
    if (!imageResponse.ok) {
      throw new Error('대표 이미지를 불러오지 못했습니다.');
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: '이미지 파일만 선택할 수 있습니다.' }, { status: 400 });
    }

    const contentLength = Number(imageResponse.headers.get('content-length') || 0);
    if (contentLength > MAX_THUMBNAIL_BYTES) {
      return NextResponse.json({ error: '대표 이미지 용량이 너무 큽니다.' }, { status: 400 });
    }

    const imageBlob = await imageResponse.blob();
    if (imageBlob.size > MAX_THUMBNAIL_BYTES) {
      return NextResponse.json({ error: '대표 이미지 용량이 너무 큽니다.' }, { status: 400 });
    }

    const folderPath = `${brandId}/${THUMBNAIL_FOLDER}`;
    const { data: existingFiles } = await context.admin.storage
      .from('brand-assets')
      .list(folderPath, { limit: 30 });

    const removablePaths = (existingFiles || [])
      .filter((file) => isSelectedThumbnailFile(file.name))
      .map((file) => `${folderPath}/${file.name}`);

    if (removablePaths.length > 0) {
      await context.admin.storage.from('brand-assets').remove(removablePaths);
    }

    const extension = getImageExtension(contentType);
    const thumbnailPath = `${folderPath}/selected-${Date.now()}.${extension}`;
    const { error: uploadError } = await context.admin.storage
      .from('brand-assets')
      .upload(thumbnailPath, imageBlob, {
        cacheControl: '31536000',
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = context.admin.storage.from('brand-assets').getPublicUrl(thumbnailPath);

    return NextResponse.json({
      success: true,
      thumbnail_url: publicUrl,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
