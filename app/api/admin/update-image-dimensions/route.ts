import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import sharp from 'sharp';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { CACHE_TAGS } from '@/lib/public-data';

interface GalleryItem {
  id: number;
  image_url: string;
  image_width: number | null;
  image_height: number | null;
}

const DEBUG_API_LOGS = process.env.DEBUG_API_LOGS === 'true';
const MAX_DIMENSION_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION_BATCH = 50;

function debugLog(...args: unknown[]) {
  if (DEBUG_API_LOGS) console.info(...args);
}

function normalizeBatchLimit(value: string | null) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 25;
  return Math.min(parsed, MAX_DIMENSION_BATCH);
}

function isAllowedGalleryImageUrl(imageUrl: string) {
  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/v1', '');
  if (!storageUrl) return false;
  return imageUrl.startsWith(`${storageUrl}/storage/v1/object/public/gallery/`);
}

async function requireAdminAccess(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const apiKey = process.env.ADMIN_API_KEY;

  if (apiKey && authHeader === `Bearer ${apiKey}`) {
    return null;
  }

  const supabaseAuth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  const userData = data as { role?: string | null } | null;

  if (!['admin', 'sub-admin'].includes(userData?.role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}

/**
 * URL에서 이미지 다운로드 후 크기 감지
 */
async function getImageDimensions(
  imageUrl: string
): Promise<{ width: number; height: number } | null> {
  try {
    if (!isAllowedGalleryImageUrl(imageUrl)) {
      throw new Error('Only gallery storage URLs are allowed');
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_DIMENSION_IMAGE_BYTES) {
      throw new Error('Image is too large');
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_DIMENSION_IMAGE_BYTES) {
      throw new Error('Image is too large');
    }

    const metadata = await sharp(buffer).metadata();

    if (metadata.width && metadata.height) {
      return {
        width: metadata.width,
        height: metadata.height,
      };
    }

    return null;
  } catch (error) {
    console.error(`❌ Failed to get dimensions for ${imageUrl}:`, error);
    return null;
  }
}

/**
 * POST /api/admin/update-image-dimensions
 * 
 * 갤러리 이미지의 메타데이터(width, height)를 업데이트합니다.
 * 
 * 쿼리 파라미터:
 * - force: true/false (기본값: false) - true이면 모든 이미지 처리, false이면 NULL인 것만)
 * - limit: number (기본값: 100) - 한 번에 처리할 이미지 개수
 */
export async function POST(request: NextRequest) {
  try {
    const authError = await requireAdminAccess(request);
    if (authError) return authError;

    const searchParams = request.nextUrl.searchParams;
    const force = searchParams.get('force') === 'true';
    const limit = normalizeBatchLimit(searchParams.get('limit'));

    debugLog('Starting image dimensions update...');
    debugLog(`Force update: ${force}`);
    debugLog(`Batch limit: ${limit}`);

    const supabase = createAdminClient();

    // 1. 갤러리 데이터 조회
    let query = supabase
      .from('gallery')
      .select('id, image_url, image_width, image_height')
      .limit(limit);

    if (!force) {
      query = query.is('image_width', null); // image_width가 NULL인 항목만
    }

    const { data: galleryItems, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch gallery items: ${fetchError.message}`);
    }

    if (!galleryItems || galleryItems.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'No items to update',
          processed: 0,
          successful: 0,
          failed: 0,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'private, no-store',
          },
        }
      );
    }

    debugLog(`Processing ${galleryItems.length} images...\n`);

    // 2. 각 이미지의 크기 감지 및 업데이트
    let successCount = 0;
    let failCount = 0;
    const results: Array<Record<string, unknown>> = [];

    for (let i = 0; i < galleryItems.length; i++) {
      const item = galleryItems[i];
      const progress = `[${i + 1}/${galleryItems.length}]`;

      debugLog(`${progress} ID: ${item.id}`);
      debugLog(`    URL: ${item.image_url}`);

      const dimensions = await getImageDimensions(item.image_url);

      if (dimensions) {
        // 3. 데이터베이스에 저장
        const { error: updateError } = await supabase
          .from('gallery')
          .update({
            image_width: dimensions.width,
            image_height: dimensions.height,
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`    ❌ Update failed: ${updateError.message}`);
          failCount++;
          results.push({
            id: item.id,
            status: 'failed',
            error: updateError.message,
          });
        } else {
          debugLog(
            `    ✅ Success - ${dimensions.width}x${dimensions.height}`
          );
          successCount++;
          results.push({
            id: item.id,
            status: 'success',
            width: dimensions.width,
            height: dimensions.height,
          });
        }
      } else {
        debugLog('    Failed to detect dimensions');
        failCount++;
        results.push({
          id: item.id,
          status: 'failed',
          error: 'Failed to detect dimensions',
        });
      }

      // Rate limiting (0.5초 대기)
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 4. 완료 보고
    debugLog('\n' + '='.repeat(50));
    debugLog('Processing completed');
    debugLog(`Successful: ${successCount}`);
    debugLog(`Failed: ${failCount}`);
    debugLog('='.repeat(50));

    if (successCount > 0) {
      revalidateTag(CACHE_TAGS.gallery, 'max');
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Image dimensions update completed',
        processed: galleryItems.length,
        successful: successCount,
        failed: failCount,
        results,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/update-image-dimensions
 * 상태 확인용 (테스트)
 */
export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdminAccess(request);
    if (authError) return authError;

    const supabase = createAdminClient();

    const [totalResult, completedResult] = await Promise.all([
      supabase.from('gallery').select('id', { count: 'planned', head: true }),
      supabase
        .from('gallery')
        .select('id', { count: 'planned', head: true })
        .not('image_width', 'is', null)
        .not('image_height', 'is', null),
    ]);

    if (totalResult.error) throw totalResult.error;
    if (completedResult.error) throw completedResult.error;

    const totalItems = totalResult.count || 0;
    const completedItems = completedResult.count || 0;
    const pendingItems = totalItems - completedItems;

    return NextResponse.json(
      {
        success: true,
        statistics: {
          totalItems,
          completedItems,
          pendingItems,
          completionPercentage: totalItems > 0 
            ? Math.round((completedItems / totalItems) * 100) 
            : 0,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
