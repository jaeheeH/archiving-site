// app/api/ai/generate/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Replicate from 'replicate';
import { getErrorMessage } from '@/lib/error-message';
import { isSafeIdentifierParam } from '@/lib/route-params';

type ReplicateTraining = {
  status?: string;
  destination?: string;
  model?: string;
  output?: {
    version?: string;
  } | null;
};

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const DEBUG_API_LOGS = process.env.DEBUG_API_LOGS === 'true';
const MAX_PROMPT_LENGTH = 1500;
const MAX_GENERATED_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_ASPECT_RATIOS = new Set([
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '4:5',
  '5:4',
]);

function debugLog(...args: unknown[]) {
  if (DEBUG_API_LOGS) console.info(...args);
}

function normalizePrompt(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_PROMPT_LENGTH);
}

function normalizeAspectRatio(value: unknown) {
  return typeof value === 'string' && ALLOWED_ASPECT_RATIOS.has(value) ? value : '1:1';
}

function normalizeSeed(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return Math.floor(Math.random() * 4294967295);
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 4294967295) {
    return null;
  }

  return numeric;
}

function normalizeOutputUrl(value: unknown) {
  if (typeof value !== 'string') return '';

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'Replicate API token is not configured.' }, { status: 500 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 });
    }

    const { brandId, prompt, aspectRatio, seed } = body;
    const safePrompt = normalizePrompt(prompt);
    const safeAspectRatio = normalizeAspectRatio(aspectRatio);
    const finalSeed = normalizeSeed(seed);
    const supabaseAuth = await createClient();
    const supabase = createAdminClient();

    // [NEW] 0. 현재 로그인한 사용자 확인
    // 서버에서 안전하게 유저 정보를 가져옵니다.
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (typeof brandId !== 'string' || !isSafeIdentifierParam(brandId) || !safePrompt) {
      return NextResponse.json({ error: '브랜드와 프롬프트가 필요합니다.' }, { status: 400 });
    }

    if (finalSeed === null) {
      return NextResponse.json({ error: 'Seed must be an integer between 0 and 4294967295.' }, { status: 400 });
    }

    const { data: brand } = await supabase
      .from('brands')
      .select('id, trigger_word, user_id')
      .eq('id', brandId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!brand) {
      return NextResponse.json({ error: '브랜드를 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // 1. 모델 정보 조회
    const { data: model, error: modelError } = await supabase.from('trained_models')
      .select('id, status, replicate_training_id')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (modelError) {
      throw modelError;
    }

    if (!model) {
      return NextResponse.json({ error: '학습된 모델이 없습니다.' }, { status: 400 });
    }

    if (!model.replicate_training_id) {
      return NextResponse.json({ error: '학습 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    // 2. 학습 정보 확인 (Lazy Check)
    const replicateTrainingId = model.replicate_training_id;
    debugLog('Fetching training info...');
    
    const training = await replicate.trainings.get(replicateTrainingId) as ReplicateTraining;

    if (model.status !== 'succeeded') {
      await supabase.from('trained_models')
        .update({ status: training.status, version_id: training.output?.version || '' })
        .eq('id', model.id);

      if (training.status !== 'succeeded') {
        if (training.status === 'failed') return NextResponse.json({ error: '학습 실패' }, { status: 400 });
        return NextResponse.json({ status: training.status, message: '학습 진행 중' });
      }
    }

    // 3. 이미지 생성 (Inference)
    if (!training.output?.version) {
        return NextResponse.json({ error: '버전 정보 없음' }, { status: 500 });
    }

    let fullModelId = '';
    const modelName = training.destination || training.model;

    if (modelName) {
        fullModelId = `${modelName}:${training.output.version}`;
    } else {
         throw new Error("모델명을 찾을 수 없습니다.");
    }

    debugLog(`Generating with Seed: ${finalSeed} (User input: ${seed ? 'Yes' : 'No'})`);

    const inputParams: Record<string, string | number | boolean> = {
      prompt: `${safePrompt}, ${brand.trigger_word}`,
      lora_scale: 0.9,
      num_inference_steps: 28,
      disable_safety_checker: true,
      output_format: "jpg",
      aspect_ratio: safeAspectRatio,
      seed: finalSeed
    };

    const output = await replicate.run(fullModelId as Parameters<typeof replicate.run>[0], {
      input: inputParams
    }) as string[];

    const replicateImageUrl = normalizeOutputUrl(output?.[0]);
    if (!replicateImageUrl) {
      throw new Error('Generated image URL is invalid.');
    }

    // 4. 저장 로직
    const imageRes = await fetch(replicateImageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!imageRes.ok) {
      throw new Error('Failed to download generated image.');
    }

    const contentType = imageRes.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Generated output is not an image: ${contentType}`);
    }

    const contentLength = Number(imageRes.headers.get('content-length') || 0);
    if (contentLength > MAX_GENERATED_IMAGE_BYTES) {
      throw new Error('Generated image is too large.');
    }

    const imageBlob = await imageRes.blob();
    if (imageBlob.size > MAX_GENERATED_IMAGE_BYTES) {
      throw new Error('Generated image is too large.');
    }

    const fileName = `${brandId}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(fileName, imageBlob, { cacheControl: '31536000', contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('generated-images')
      .getPublicUrl(fileName);

    // 5. DB에 기록 (작성자 ID 포함!)
    await supabase.from('generated_images').insert({
      brand_id: brandId,
      image_url: publicUrl,
      prompt: safePrompt,
      aspect_ratio: safeAspectRatio,
      seed: finalSeed,
      user_id: user.id // [핵심] 여기에 작성자 ID가 들어갑니다.
    });

    return NextResponse.json({ 
      success: true, 
      imageUrl: publicUrl, 
      status: 'succeeded',
      seed: finalSeed 
    });

  } catch (error: unknown) {
    console.error('Gen Error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
