import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Replicate from 'replicate';
import JSZip from 'jszip';
import { getBrandManagerContext } from '@/lib/brand-manager-auth';
import { getErrorMessage } from '@/lib/error-message';
import { isSafeIdentifierParam } from '@/lib/route-params';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const DEBUG_API_LOGS = process.env.DEBUG_API_LOGS === 'true';
const MAX_TRAINING_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TRAINING_TOTAL_BYTES = 80 * 1024 * 1024;
const MIN_TRAINING_IMAGES = 5;
const MAX_TRAINING_IMAGES = 25;
const ACTIVE_TRAINING_STATUSES = new Set(['starting', 'processing']);

function debugLog(...args: unknown[]) {
  if (DEBUG_API_LOGS) console.info(...args);
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

async function downloadImage(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Failed to download image: ${url}`);

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Training asset is not an image: ${url}`);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_TRAINING_IMAGE_BYTES) {
    throw new Error(`Training image is too large: ${url}`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_TRAINING_IMAGE_BYTES) {
    throw new Error(`Training image is too large: ${url}`);
  }

  return buffer;
}

export async function POST(request: Request) {
  let uploadedTrainingZipPath: string | null = null;
  let cleanupClient: ReturnType<typeof createAdminClient> | null = null;

  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'Replicate API token is not configured.' }, { status: 500 });
    }

    const body = await parseJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 });
    }

    const { brandId, imageUrls } = body;
    const context = await getBrandManagerContext();
    if (context.response) return context.response;
    const supabase = context.admin;
    cleanupClient = supabase;

    // 1. 필수 값 검증
    if (typeof brandId !== 'string' || !isSafeIdentifierParam(brandId) || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    if (imageUrls.length < MIN_TRAINING_IMAGES || imageUrls.length > MAX_TRAINING_IMAGES) {
      return NextResponse.json({ error: '학습 이미지는 5장 이상 25장 이하로 등록해주세요.' }, { status: 400 });
    }

    // 2. 브랜드 정보 가져오기
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, trigger_word, user_id')
      .eq('id', brandId)
      .eq('user_id', context.user.id)
      .maybeSingle();

    if (brandError) {
      throw brandError;
    }

    if (!brand) {
      return NextResponse.json({ error: '브랜드를 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    const { data: latestTraining, error: latestTrainingError } = await supabase
      .from('trained_models')
      .select('id, status, replicate_training_id')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestTrainingError) {
      throw latestTrainingError;
    }

    if (latestTraining?.status && ACTIVE_TRAINING_STATUSES.has(latestTraining.status)) {
      return NextResponse.json(
        {
          success: false,
          status: latestTraining.status,
          trainingId: latestTraining.replicate_training_id,
          message: '이미 진행 중인 학습이 있습니다.',
        },
        { status: 409 }
      );
    }

    const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('/v1', '');
    const allowedPrefix = `${storageUrl}/storage/v1/object/public/brand-assets/${brandId}/`;
    const validImageUrls = imageUrls.filter(
      (url: unknown): url is string => typeof url === 'string' && url.startsWith(allowedPrefix)
    );

    if (validImageUrls.length !== imageUrls.length) {
      return NextResponse.json({ error: '브랜드 자산 폴더의 이미지 URL만 학습에 사용할 수 있습니다.' }, { status: 400 });
    }

    // 3. Zip 압축
    debugLog(`Starting to zip ${validImageUrls.length} images...`);
    const zip = new JSZip();
    let successfulDownloads = 0;
    let totalDownloadBytes = 0;

    for (let index = 0; index < validImageUrls.length; index += 1) {
      const url = validImageUrls[index];
      try {
        const arrayBuffer = await downloadImage(url);
        totalDownloadBytes += arrayBuffer.byteLength;

        if (totalDownloadBytes > MAX_TRAINING_TOTAL_BYTES) {
          return NextResponse.json(
            { error: '학습 이미지 전체 용량이 너무 큽니다. 이미지를 압축하거나 개수를 줄여주세요.' },
            { status: 400 }
          );
        }

        const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
        zip.file(`${index}.${ext}`, arrayBuffer);
        successfulDownloads += 1;
      } catch (e) {
        console.error(`Error downloading image ${url}:`, e);
      }
    }

    if (successfulDownloads < MIN_TRAINING_IMAGES) {
      return NextResponse.json({ error: '다운로드 가능한 학습 이미지가 5장 미만입니다.' }, { status: 400 });
    }

    const zipContent = await zip.generateAsync({ type: 'blob' });
    const zipArrayBuffer = await zipContent.arrayBuffer();
    
    // 4. Supabase에 Zip 업로드
    const zipFileName = `${brandId}/training_set_${Date.now()}.zip`;
    const { error: uploadError } = await supabase.storage
      .from('brand-assets')
      .upload(zipFileName, zipArrayBuffer, {
        cacheControl: '31536000',
        contentType: 'application/zip',
        upsert: false
      });

    if (uploadError) throw uploadError;
    uploadedTrainingZipPath = zipFileName;

    const { data: { publicUrl: zipUrl } } = supabase.storage
      .from('brand-assets')
      .getPublicUrl(zipFileName);

    debugLog('Zip file uploaded to:', zipUrl);

    // 5. Replicate 학습 요청 준비
    const owner = process.env.REPLICATE_USER_ID;
    if (!owner) throw new Error("REPLICATE_USER_ID 환경변수가 설정되지 않았습니다.");

    const safeName = brand.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'brand';
    const modelName = `${safeName}-${Math.floor(Date.now() / 1000)}`;
    const destination = `${owner}/${modelName}`;

    debugLog(`Creating model container: ${destination}`);

    try {
      await replicate.models.create(owner, modelName, {
        visibility: "private",
        hardware: "gpu-t4",
      });
    } catch (e: unknown) {
      debugLog("Model creation info:", getErrorMessage(e));
    }

    // [핵심 수정] 학습용 모델의 최신 버전을 동적으로 가져옵니다.
    // 이렇게 하면 구버전 ID 문제(404 에러)가 완벽하게 해결됩니다.
    debugLog("Fetching latest trainer version...");
    const trainerModel = await replicate.models.get("ostris", "flux-dev-lora-trainer");
    const latestVersion = trainerModel.latest_version?.id;

    if (!latestVersion) {
        throw new Error("Trainer model version not found");
    }

    debugLog(`Starting training using version: ${latestVersion}`);

    // 학습 시작 요청
    const training = await replicate.trainings.create(
      "ostris",
      "flux-dev-lora-trainer",
      latestVersion, // [수정됨] 동적으로 가져온 최신 ID 사용
      {
        destination: destination as `${string}/${string}`,
        input: {
          input_images: zipUrl,
          trigger_word: brand.trigger_word,
          steps: 1000,
          lora_rank: 16,
          optimizer: "adamw8bit",
          learning_rate: 0.0004
        }
      }
    );
    uploadedTrainingZipPath = null;

    debugLog('Training started:', training.id);

    // 6. DB 저장
    const { error: insertError } = await supabase.from('trained_models').insert({
      brand_id: brandId,
      replicate_training_id: training.id,
      status: 'starting',
      version_id: '' 
    });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ success: true, trainingId: training.id });

  } catch (error: unknown) {
    if (cleanupClient && uploadedTrainingZipPath) {
      const { error: cleanupError } = await cleanupClient.storage
        .from('brand-assets')
        .remove([uploadedTrainingZipPath]);

      if (cleanupError) {
        console.error('Training zip cleanup failed:', cleanupError);
      }
    }

    console.error('Training Error:', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Server Error') }, { status: 500 });
  }
}
