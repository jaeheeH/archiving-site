import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createAdminClient } from '@/lib/supabase/admin';

interface GalleryItem {
  id: number;
  image_url: string;
  image_width: number | null;
  image_height: number | null;
}

/**
 * URL에서 이미지 다운로드 후 크기 감지
 */
async function getImageDimensions(
  imageUrl: string
): Promise<{ width: number; height: number } | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
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
    // 환경 변수 확인 (보안)
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.ADMIN_API_KEY;

    // 선택적: API 키로 보호 (설정했으면)
    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const force = searchParams.get('force') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');

    console.log('🚀 Starting image dimensions update...');
    console.log(`📊 Force update: ${force}`);
    console.log(`📊 Batch limit: ${limit}`);

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
        { status: 200 }
      );
    }

    console.log(`📊 Processing ${galleryItems.length} images...\n`);

    // 2. 각 이미지의 크기 감지 및 업데이트
    let successCount = 0;
    let failCount = 0;
    const results: any[] = [];

    for (let i = 0; i < galleryItems.length; i++) {
      const item = galleryItems[i];
      const progress = `[${i + 1}/${galleryItems.length}]`;

      console.log(`${progress} ID: ${item.id}`);
      console.log(`    URL: ${item.image_url}`);

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
          console.log(
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
        console.log('    ❌ Failed to detect dimensions');
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
    console.log('\n' + '='.repeat(50));
    console.log('📈 Processing completed');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('='.repeat(50));

    return NextResponse.json(
      {
        success: true,
        message: 'Image dimensions update completed',
        processed: galleryItems.length,
        successful: successCount,
        failed: failCount,
        results,
      },
      { status: 200 }
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
    const supabase = createAdminClient();

    // 갤러리 데이터 통계
    const { data: allItems } = await supabase
      .from('gallery')
      .select('id, image_width, image_height');

    const totalItems = allItems?.length || 0;
    const completedItems =
      allItems?.filter((item) => item.image_width !== null).length || 0;
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
      { status: 200 }
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