// app/api/brands/route.ts
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBrandManagerContext } from '@/lib/brand-manager-auth';
import { getErrorMessage } from '@/lib/error-message';
import { isSafeIdentifierParam } from '@/lib/route-params';

const MAX_BRAND_NAME_LENGTH = 80;

function normalizeBrandName(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_BRAND_NAME_LENGTH);
}

function requireBrandId(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return isSafeIdentifierParam(trimmed) ? trimmed : '';
}

const SELECTED_THUMBNAIL_FOLDER = '__thumbnail__';

function isBrandAssetImage(name: string) {
  return /\.(jpe?g|png|webp)$/i.test(name);
}

function isSelectedThumbnailFile(name: string) {
  return /^selected(?:-[a-zA-Z0-9_-]+)?\.(jpe?g|png|webp)$/i.test(name);
}

async function getSelectedBrandThumbnailUrl(
  admin: ReturnType<typeof createAdminClient>,
  brandId: string
) {
  const { data, error } = await admin.storage
    .from('brand-assets')
    .list(`${brandId}/${SELECTED_THUMBNAIL_FOLDER}`, {
      limit: 10,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error || !data?.length) return null;

  const selectedImage = data.find((asset) => isSelectedThumbnailFile(asset.name));
  if (!selectedImage) return null;

  const {
    data: { publicUrl },
  } = admin.storage
    .from('brand-assets')
    .getPublicUrl(`${brandId}/${SELECTED_THUMBNAIL_FOLDER}/${selectedImage.name}`);

  return publicUrl;
}

async function getLatestGeneratedThumbnailUrl(
  admin: ReturnType<typeof createAdminClient>,
  brandId: string,
  userId: string
) {
  const { data, error } = await admin
    .from('generated_images')
    .select('image_url')
    .eq('brand_id', brandId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.image_url) return null;
  return data.image_url as string;
}

async function getBrandAssetFallbackThumbnailUrl(
  admin: ReturnType<typeof createAdminClient>,
  brandId: string
) {
  const { data, error } = await admin.storage
    .from('brand-assets')
    .list(brandId, {
      limit: 30,
      sortBy: { column: 'created_at', order: 'asc' },
    });

  if (error || !data?.length) return null;

  const firstImage = data.find((asset) => isBrandAssetImage(asset.name));
  if (!firstImage) return null;

  const {
    data: { publicUrl },
  } = admin.storage.from('brand-assets').getPublicUrl(`${brandId}/${firstImage.name}`);

  return publicUrl;
}

async function getBrandThumbnailUrl(
  admin: ReturnType<typeof createAdminClient>,
  brandId: string,
  userId: string
) {
  const selectedThumbnail = await getSelectedBrandThumbnailUrl(admin, brandId);
  if (selectedThumbnail) return selectedThumbnail;

  const latestGeneratedThumbnail = await getLatestGeneratedThumbnailUrl(admin, brandId, userId);
  if (latestGeneratedThumbnail) return latestGeneratedThumbnail;

  return getBrandAssetFallbackThumbnailUrl(admin, brandId);
}

async function parseJsonObject(request: Request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// 1. 브랜드 목록 가져오기 (기존과 동일)
export async function GET() {
  try {
    const context = await getBrandManagerContext();
    if (context.response) return context.response;

    const { data, error } = await context.admin
      .from('brands')
      .select(`
        id,
        name,
        trigger_word,
        created_at,
        trained_models (status, created_at)
      `)
      .eq('user_id', context.user.id)
      .order('created_at', { ascending: false })
      .order('created_at', { ascending: false, referencedTable: 'trained_models' })
      .limit(1, { referencedTable: 'trained_models' });

    if (error) throw error;

    const brandsWithThumbnails = await Promise.all(
      (data || []).map(async (brand) => ({
        ...brand,
        thumbnail_url: await getBrandThumbnailUrl(context.admin, brand.id, context.user.id),
      }))
    );

    return NextResponse.json(brandsWithThumbnails, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

// 2. [변경] 브랜드 생성 (POST) - 트리거 자동 생성
export async function POST(request: Request) {
  try {
    // 이제 trigger_word는 받지 않습니다.
    const body = await parseJsonObject(request);
    if (!body) return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 });

    const brandName = normalizeBrandName(body.name);
    const context = await getBrandManagerContext();
    if (context.response) return context.response;

    if (!brandName) {
      return NextResponse.json({ error: '브랜드 이름이 필요합니다.' }, { status: 400 });
    }

    // [핵심] 시스템이 트리거 단어 자동 생성
    // 규칙: "OHJI_" + "랜덤6자리" (예: OHJI_X9Z1A2)
    // 이렇게 하면 전 세계에서 절대 겹칠 일이 없고, AI에게도 매우 유니크한 단어로 인식됩니다.
    const randomSuffix = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
    const autoTriggerWord = `OHJI_${randomSuffix}`;

    const { data, error } = await context.admin
      .from('brands')
      .insert({
        name: brandName,
        trigger_word: autoTriggerWord, // 자동 생성된 값 주입
        user_id: context.user.id
      })
      .select('id, name, trigger_word, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

// 3. [변경] 브랜드 수정 (PUT) - 트리거 수정 불가
export async function PUT(request: Request) {
  try {
    // 트리거 단어는 아예 받지도, 수정하지도 않습니다. 오직 이름만!
    const body = await parseJsonObject(request);
    if (!body) return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 });

    const brandId = requireBrandId(body.id);
    const brandName = normalizeBrandName(body.name);
    const context = await getBrandManagerContext();
    if (context.response) return context.response;

    if (!brandId || !brandName) {
      return NextResponse.json({ error: '브랜드 ID와 이름이 필요합니다.' }, { status: 400 });
    }

    const { data, error } = await context.admin
      .from('brands')
      .update({ name: brandName }) // 이름만 수정 가능
      .eq('id', brandId)
      .eq('user_id', context.user.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: '브랜드를 찾을 수 없습니다.' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

// 4. 삭제 (DELETE) - 기존과 동일
export async function DELETE(request: Request) {
  try {
    const body = await parseJsonObject(request);
    if (!body) return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 });

    const brandId = requireBrandId(body.id);
    const context = await getBrandManagerContext();
    if (context.response) return context.response;

    if (!brandId) {
      return NextResponse.json({ error: '브랜드 ID가 필요합니다.' }, { status: 400 });
    }

    const { data, error } = await context.admin
      .from('brands')
      .delete()
      .eq('id', brandId)
      .eq('user_id', context.user.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: '브랜드를 찾을 수 없습니다.' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
